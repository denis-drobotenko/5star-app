import XLSX from 'xlsx';
import { s3Client, S3_BUCKET_NAME } from '../config/s3.js';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from 'uuid';
import logger from '../config/logger.js';
import { sanitizeFileName } from '../../shared/utils/filenameUtils.js';

class XlsxService {
    /**
     * Parses an XLSX file buffer.
     * @param {Buffer} buffer - The XLSX file buffer.
     * @returns {object} - Parsed data: { fields, rows, totalRows, previewRows }.
     */
    static parseXlsxBuffer(buffer: any) {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

        if (rawRows.length === 0) {
            return {
                fields: [],
                rows: [],
                totalRows: 0,
                previewRows: 0
            };
        }

        const headers: string[] = rawRows[0] as string[];
        const dataRowsOnly = rawRows.slice(1) as any[][];

        let objectRows = dataRowsOnly.map((rowArray: any[]) => {
            const obj: any = {};
            headers.forEach((header: string, index: number) => {
                obj[header] = rowArray[index];
            });
            return obj;
        });

        const filteredObjectRows = objectRows.filter((row: any) => {
            if (Object.keys(row).length === 0) return false;
            const values = Object.values(row);
            return values.some((value: any) => value !== null && value !== undefined && String(value).trim() !== '');
        });

        const previewFilteredRows = filteredObjectRows.slice(0, 100);

        return {
            fields: headers,
            rows: previewFilteredRows,
            totalRows: dataRowsOnly.length,
            previewRows: previewFilteredRows.length
        };
    }

    /**
     * Processes an uploaded XLSX file: parses it, saves to S3, and generates a signed URL.
     * @param {object} file - The uploaded file object (e.g., from multer).
     * @param {Buffer} file.buffer - File content.
     * @param {string} file.originalname - Original name of the file.
     * @param {string} file.mimetype - Mime type of the file.
     * @returns {Promise<object>} - Result object with parsed data, S3 info, and original file name.
     * @throws {Error} If S3 upload fails or any other processing error occurs.
     */
    static async handleUploadedXlsx(file: any) {
        logger.debug('[XlsxService.handleUploadedXlsx] Processing uploaded file: %s', file.originalname);
        const parsedData = XlsxService.parseXlsxBuffer(file.buffer);

        let originalDisplayName = file.originalname;
        try {
            // Попытка декодировать имя файла из latin1 в utf8, если оно было некорректно передано
            const buffer = Buffer.from(originalDisplayName, 'latin1');
            const decodedName = buffer.toString('utf8');
            // Проверяем на наличие символа замены, который указывает на неудачное декодирование
            if (!decodedName.includes('\uFFFD')) {
                originalDisplayName = decodedName;
            } else {
                 // Если latin1 -> utf8 не помогло, пробуем utf8 -> utf8 (на случай если файл уже в utf8 но интерпретирован как latin1 где-то ранее)
                 originalDisplayName = Buffer.from(file.originalname, 'utf8').toString('utf8');
            }
        } catch (e: any) {
            logger.warn('[XlsxService.handleUploadedXlsx] Failed to decode original file name: %s. Error: %s', file.originalname, (e as any).message);
            // Оставляем originalDisplayName как есть, если декодирование не удалось
        }

        const sanitizedFileNameForS3 = sanitizeFileName(file.originalname); // Санитизируем исходное имя для ключа S3
        const originalFileKey = `original-xlsx-uploads/${uuidv4()}-${sanitizedFileNameForS3}`;
        
        let originalFileUrl = '';
        let signedOriginalFileUrl = '';

        if (!S3_BUCKET_NAME) {
            logger.error('[XlsxService.handleUploadedXlsx] S3_BUCKET_NAME is not configured.');
            // В этом случае мы не можем сохранить файл, но можем вернуть распарсенные данные
            // Или можно бросить ошибку, чтобы контроллер вернул 500
            // Пока что просто не будем пытаться сохранить и вернем пустые S3 поля
        } else {
            try {
                const putObjectParams = {
                    Bucket: S3_BUCKET_NAME,
                    Key: originalFileKey,
                    Body: file.buffer,
                    ContentType: file.mimetype
                };
                await s3Client.send(new PutObjectCommand(putObjectParams));
                originalFileUrl = `${process.env.S3_ENDPOINT || 'https://s3.regru.cloud'}/${S3_BUCKET_NAME}/${originalFileKey}`;

                const command = new GetObjectCommand({ Bucket: S3_BUCKET_NAME, Key: originalFileKey });
                signedOriginalFileUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

                logger.info(`[XlsxService.handleUploadedXlsx] File ${originalDisplayName} successfully saved to S3 as ${originalFileKey}`);
            } catch (s3Error) {
                logger.error('[XlsxService.handleUploadedXlsx] Error saving original XLSX file to S3', {
                    fileName: originalDisplayName,
                    s3Key: originalFileKey,
                    error: (s3Error as any).message
                });
                // Не прерываем из-за ошибки S3, просто URL останутся пустыми
                originalFileUrl = ''; 
                signedOriginalFileUrl = '';
            }
        }
        
        return {
            ...parsedData,
            originalFileUrl,
            originalFileKey,
            signedOriginalFileUrl,
            originalFileName: originalDisplayName
        };
    }

    /**
     * Downloads an XLSX file from S3, parses it, and extracts the original file name.
     * @param {string} s3Key - The S3 key (path) to the file.
     * @returns {Promise<object>} - Result object with parsed data, S3 key, and original file name.
     * @throws {Error} If S3 download, file parsing, or any other processing error occurs.
     */
    static async handleS3Xlsx(s3Key: any) {
        logger.debug('[XlsxService.handleS3Xlsx] Processing S3 XLSX file. Key: %s', s3Key);

        if (!S3_BUCKET_NAME) {
            logger.error('[XlsxService.handleS3Xlsx] S3_BUCKET_NAME is not configured.');
            const error = new Error('S3_BUCKET_NAME не настроен на сервере.');
            (error as any).statusCode = 500; // Internal Server Error
            throw error;
        }

        let s3ObjectResponse;
        try {
            s3ObjectResponse = await s3Client.send(new GetObjectCommand({
                Bucket: S3_BUCKET_NAME,
                Key: s3Key,
            }));
            logger.info('[XlsxService.handleS3Xlsx] Successfully retrieved S3 object metadata. Key: %s', s3Key);
        } catch (s3GetError: any) {
            logger.error('[XlsxService.handleS3Xlsx] Failed to get object from S3. Key: %s. Error: %s', s3Key, (s3GetError as any).message, { error: s3GetError });
            if ((s3GetError as any).name === 'NoSuchKey') {
                const error = new Error('Файл не найден в S3 по указанному ключу');
                (error as any).statusCode = 404;
                throw error;
            }
            throw s3GetError; // Re-throw other S3 errors
        }

        let fileBuffer: any;
        try {
            const streamToBuffer = (stream: any) =>
                new Promise((resolve, reject) => {
                    const chunks: any[] = [];
                    stream.on('data', (chunk: any) => chunks.push(chunk));
                    stream.on('error', reject);
                    stream.on('end', () => resolve(Buffer.concat(chunks)));
                });
            fileBuffer = await streamToBuffer(s3ObjectResponse.Body);
            logger.debug('[XlsxService.handleS3Xlsx] S3 object body converted to buffer. Size: %d bytes', fileBuffer.length);
        } catch (bufferError: any) {
            logger.error('[XlsxService.handleS3Xlsx] Failed to convert S3 stream to buffer. Key: %s. Error: %s', s3Key, (bufferError as any).message, { error: bufferError });
            const error = new Error('Ошибка при чтении содержимого файла из S3: ' + bufferError.message);
            (error as any).statusCode = 500;
            throw error;
        }

        let parsedData;
        try {
            parsedData = XlsxService.parseXlsxBuffer(fileBuffer);
            logger.debug('[XlsxService.handleS3Xlsx] S3 file %s parsed successfully.', s3Key);
        } catch (parseError: any) {
            logger.error('[XlsxService.handleS3Xlsx] Failed to parse XLSX from S3 buffer. Key: %s. Error: %s', s3Key, (parseError as any).message, { error: parseError });
            const error = new Error('Ошибка при внутреннем разборе XLSX файла из S3: ' + parseError.message);
            (error as any).statusCode = 500;
            throw error;
        }

        let originalFileName = 'unknownfile.xlsx';
        if (s3Key.includes('/')) {
            const keyParts = s3Key.split('/');
            const fileNameWithPossiblyUuid = keyParts[keyParts.length - 1];
            // Regex to match UUID followed by the original filename part
            const uuidRegex = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}-)(.+)$/;
            const match = fileNameWithPossiblyUuid.match(uuidRegex);
            if (match && match[2]) {
                originalFileName = match[2];
            } else {
                originalFileName = fileNameWithPossiblyUuid; // Fallback to the full last part if no UUID match
            }
        } else {
            originalFileName = s3Key; // If no slashes, the key itself is the filename
        }
        logger.debug('[XlsxService.handleS3Xlsx] Extracted originalFileName: %s from S3 key: %s', originalFileName, s3Key);

        return {
            ...parsedData,
            originalFileName,
            s3Key
        };
    }

    // Другие методы будут добавлены сюда
}

export default XlsxService; 