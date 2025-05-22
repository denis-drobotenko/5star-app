import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom'; // useParams может понадобиться здесь или остаться в компоненте
import { message } from 'antd';
import apiClient from '../../../shared/api/apiClient';
import { getFieldValidationStatus } from '../services/dataImportUtils';

// Временная заглушка, пока dataImportUtils не создан
// const getFieldValidationStatus = (originalRules, fileHeaders) => {
// console.warn("getFieldValidationStatus is a placeholder in useDataImportProcess.js");
// if (!originalRules || originalRules.length === 0) {
// return {
// foundFields: [],
// missingFields: [],
// unusedFileHeaders: [...fileHeaders],
// allRequiredFound: true, 
// errorMessages: []
// };
// }
// const foundFields = [];
// const missingFields = [];
// const templateSourceFields = new Set();
// const errorMessages = [];
// originalRules.forEach(rule => {
// if (rule.source_field) {
// templateSourceFields.add(rule.source_field);
// if (fileHeaders.includes(rule.source_field)) {
// foundFields.push({ templateField: rule.source_field, systemField: rule.target_field || 'N/A' });
// } else {
// missingFields.push({ templateField: rule.source_field, systemField: rule.target_field || 'N/A' });
// errorMessages.push(`Поле шаблона "${rule.source_field}" отсутствует в файле.`);
// }
// }
// });
// const unusedFileHeaders = fileHeaders.filter(header => !templateSourceFields.has(header));
// const allRequiredFound = missingFields.length === 0;
// return { foundFields, missingFields, unusedFileHeaders, allRequiredFound, errorMessages };
// };


export const useDataImportProcess = (initialActiveImportId = null, initialIsCreatingNew = false) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [imports, setImports] = useState([]);
    const [isLoadingImports, setIsLoadingImports] = useState(false);
    const [clients, setClients] = useState([]);
    const [isLoadingClients, setIsLoadingClients] = useState(false);
    const [fieldMappings, setFieldMappings] = useState([]);
    const [isLoadingFieldMappings, setIsLoadingFieldMappings] = useState(false);

    const [activeImportId, setActiveImportId] = useState(initialActiveImportId);
    const [activeImportData, setActiveImportData] = useState(null);
    const [isCreatingNewImport, setIsCreatingNewImport] = useState(initialIsCreatingNew);
    
    const [selectedClient, setSelectedClient] = useState(null);
    const [selectedFieldMapping, setSelectedFieldMapping] = useState(null);
    const [originalMappingRules, setOriginalMappingRules] = useState([]);
    const [customImportName, setCustomImportName] = useState('');

    const [selectedFile, setSelectedFile] = useState(null);
    const [fileHeaders, setFileHeaders] = useState([]);
    const [currentMappingRules, setCurrentMappingRules] = useState([]); 
    
    const [uploading, setUploading] = useState(false);
    const [processingResult, setProcessingResult] = useState(null);
    const [error, setError] = useState(null);
    const [finalizingImport, setFinalizingImport] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [validationStatus, setValidationStatus] = useState(null);
    const [processingErrorDetails, setProcessingErrorDetails] = useState(null);

    const navigate = useNavigate();

    const resetActiveImportStates = useCallback(() => {
        console.log('[useDataImportProcess] resetActiveImportStates called');
        setCurrentStep(0);
        setSelectedClient(null);
        setSelectedFieldMapping(null);
        setCustomImportName('');
        setOriginalMappingRules([]);
        setSelectedFile(null);
        setFileHeaders([]);
        setCurrentMappingRules([]);
        setProcessingResult(null);
        setError(null);
        setProcessingErrorDetails(null);
        setValidationStatus(null);
    }, []);

    const fetchImports = useCallback(async () => {
        console.log("[useDataImportProcess] Fetching imports history...");
        setIsLoadingImports(true);
        try {
            const response = await apiClient.getImports();
            if (response && response.items && Array.isArray(response.items)) {
                setImports(response.items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
            } else {
                setImports([]);
            }
        } catch (err) {
            message.error(`Ошибка загрузки истории импортов: ${err.message}`);
        } finally {
            setIsLoadingImports(false);
        }
    }, []);

    const fetchClients = useCallback(async () => {
        console.log("[useDataImportProcess] Fetching clients...");
        setIsLoadingClients(true);
        try {
            const response = await apiClient.getClients();
            if (response && Array.isArray(response)) {
                setClients(response);
            } else {
                setClients([]);
                setError("Не удалось загрузить список клиентов.");
            }
        } catch (err) {
            setError(`Ошибка загрузки клиентов: ${err.message}`);
            message.error(`Ошибка загрузки клиентов: ${err.message}`);
        } finally {
            setIsLoadingClients(false);
        }
    }, []);

    const fetchFieldMappingsForClient = useCallback(async (clientId) => {
        if (!clientId) {
            setFieldMappings([]);
            return;
        }
        setIsLoadingFieldMappings(true);
        try {
            const response = await apiClient.getFieldMappings(clientId);
            let mappingsData = Array.isArray(response) ? response : [];
            if (mappingsData.length > 0) {
                mappingsData.sort((a, b) => {
                    const dateA = a.createdAt || a.created_at;
                    const dateB = b.createdAt || b.created_at;
                    return new Date(dateB) - new Date(dateA);
                });
            }
            setFieldMappings(mappingsData);
        } catch (error) {
            message.error('Ошибка загрузки правил маппинга.');
            setFieldMappings([]);
        } finally {
            setIsLoadingFieldMappings(false);
        }
    }, []);

    const initializeMappingTable = useCallback((baseRulesParam = [], headers = []) => {
        const baseRules = Array.isArray(baseRulesParam) ? baseRulesParam : [];
        const newHeaders = Array.isArray(headers) ? headers : [];
        console.log('[useDataImportProcess] initializeMappingTable CALLED. BaseRules:', baseRules, 'Headers:', newHeaders);
        
        const newRules = [];
        const usedHeaders = new Set();

        baseRules.forEach((rule, index) => {
            newRules.push({
                id: `base-${rule.target_field || 'norule'}-${index}`,
                targetField: rule.target_field || null,
                sourceField: rule.source_field || null, 
                defaultValue: rule.default_value !== undefined ? rule.default_value : '',
                processing: rule.processing || { function: 'NONE', params: {} },
                isFromTemplate: true, 
            });
            if (rule.source_field && newHeaders.includes(rule.source_field)) {
                usedHeaders.add(rule.source_field);
            }
        });
        newHeaders.forEach(header => {
            if (!usedHeaders.has(header)) {
                newRules.push({
                    id: `header-${header}`,
                    targetField: null, sourceField: header, defaultValue: '',
                    processing: { function: 'NONE', params: {} },
                    isFromTemplate: false,
                });
            }
        });
        setCurrentMappingRules(newRules);
    }, []);

    useEffect(() => {
        if (selectedClient) {
            fetchFieldMappingsForClient(selectedClient);
        } else {
            setFieldMappings([]); // Clear mappings if no client is selected
        }
    }, [selectedClient, fetchFieldMappingsForClient]);

    useEffect(() => {
        let currentRulesToInitialize = [];
        if (selectedFieldMapping && fieldMappings.length > 0) {
            const chosenMappingTemplate = fieldMappings.find(fm => fm.id === selectedFieldMapping);
            if (chosenMappingTemplate && chosenMappingTemplate.mapping && typeof chosenMappingTemplate.mapping === 'object') {
                const rulesArray = Object.entries(chosenMappingTemplate.mapping).map(([targetField, ruleDetails]) => ({
                    target_field: targetField,
                    source_field: ruleDetails.field,
                    default_value: ruleDetails.default_value !== undefined ? ruleDetails.default_value : (ruleDetails.defaultValue !== undefined ? ruleDetails.defaultValue : ''),
                    processing: ruleDetails.processing || { function: 'NONE', params: {} },
                }));
                setOriginalMappingRules(rulesArray);
                currentRulesToInitialize = rulesArray;
            } else {
                setOriginalMappingRules([]); // Template not found or invalid
            }
        } else {
             setOriginalMappingRules([]); // No template selected
        }
        // Always re-initialize the table when original rules or file headers change
        initializeMappingTable(currentRulesToInitialize, fileHeaders);

    }, [selectedFieldMapping, fieldMappings, fileHeaders, initializeMappingTable]); // Added fileHeaders dependency

    useEffect(() => {
        if (isCreatingNewImport && currentStep === 0 && selectedClient && fieldMappings.length > 0 && !selectedFieldMapping) {
            const latestMapping = fieldMappings.find(fm => fm.default_mapping) || fieldMappings[0]; // Prefer default, then latest
            if (latestMapping && latestMapping.id) {
                setSelectedFieldMapping(latestMapping.id);
                message.info(`Автоматически выбран шаблон: ${latestMapping.name}`, 2);
            }
        }
    }, [isCreatingNewImport, currentStep, selectedClient, fieldMappings, selectedFieldMapping]);

    const handleStartNewImport = useCallback(() => {
        resetActiveImportStates();
        setIsCreatingNewImport(true);
        setActiveImportId(null); 
        setActiveImportData(null);
        setCurrentStep(0);
    }, [resetActiveImportStates]);

    const handleSelectImportFromHistory = useCallback(async (importItem) => {
        resetActiveImportStates();
        setIsCreatingNewImport(false);
        setActiveImportId(importItem.id);
        setActiveImportData(importItem);
        setSelectedClient(importItem.client_id);
        setSelectedFieldMapping(importItem.field_mapping_id);
        setCustomImportName(importItem.custom_name || '');
        
        // Logic to potentially load file headers and preview from backend for existing import
        if (importItem.s3_key_original_file && (importItem.status === 'file_uploaded' || importItem.status === 'preview_ready' || importItem.status === 'processing_failed')) {
            // This implies we might need a new API endpoint or modify uploadFile to just get info
            // For now, this is a placeholder for future enhancement.
            // Example: const data = await apiClient.getImportPreviewDetails(importItem.id);
            // if (data) { setFileHeaders(data.headers); setProcessingResult(data.processingResult); }
        }


        let resumeStep = 0;
        switch (importItem.status) {
            case 'initiated': resumeStep = 0; break;
            case 'file_uploaded': case 'processing_failed': case 'preview_ready': resumeStep = 1; break;
            case 'completed': case 'failed': resumeStep = 3; break; // Go to results for completed/failed
            default: resumeStep = 0;
        }
        setCurrentStep(resumeStep);
        const clientNameForMessage = clients.find(c=>c.id === importItem.client_id)?.name || 'N/A';
        message.info(`Загружен импорт ID: ${importItem.id} (Клиент: ${clientNameForMessage}). Статус: ${importItem.status}.`);
    }, [resetActiveImportStates, clients]);

    const handleCancelActiveImport = useCallback(() => {
        resetActiveImportStates();
        setIsCreatingNewImport(false);
        setActiveImportId(null);
        setActiveImportData(null);
    }, [resetActiveImportStates]);

    const handleClientChange = useCallback((value) => {
        setSelectedClient(value);
        setSelectedFieldMapping(null); 
        setOriginalMappingRules([]); 
        // File and headers are not reset, user might want to apply same file to different client/template
    }, []);

    const handleFieldMappingChange = useCallback((value) => {
        setSelectedFieldMapping(value); 
    }, []);

    const handleCustomImportNameChange = useCallback((e) => {
        setCustomImportName(e.target.value);
    }, []);

    const handleFileChange = useCallback((file) => {
        setError(null);
        setProcessingResult(null);
        setProcessingErrorDetails(null);
        // Critical: Reset fileHeaders and validationStatus when a new file is selected *before* upload attempt
        setFileHeaders([]);
        setValidationStatus(null);
        // initializeMappingTable will be called by useEffect due to fileHeaders change if originalMappingRules exist

        if (file) {
            setSelectedFile(file);
            message.success(`${file.name} выбран.`);
        } else {
            setSelectedFile(null);
        }
    }, []);

    const handleFileUpload = useCallback(async () => {
        if (!selectedFile || !activeImportId) {
            message.error('Файл не выбран или сессия импорта не активна.');
            return;
        }
        if (!selectedFieldMapping) { // Добавлена проверка
            message.error('Шаблон сопоставления не выбран. Пожалуйста, выберите шаблон.');
            return;
        }

        setUploading(true);
        setError(null);
        setProcessingResult(null);
        setProcessingErrorDetails(null);
        setUploadProgress(0);
        setValidationStatus(null); // Сбрасываем статус валидации перед новой загрузкой

        try {
            const result = await apiClient.uploadFile(activeImportId, selectedFile, (event) => {
                if (event.lengthComputable) {
                    const percent = Math.round((event.loaded / event.total) * 100);
                    setUploadProgress(percent);
                }
            });
            console.log("[useDataImportProcess] apiClient.uploadFile RAW result:", result);
            if (result && result.statistics) {
                 console.log("[useDataImportProcess] apiClient.uploadFile result.statistics OBJECT:", JSON.stringify(result.statistics));
                 console.log("[useDataImportProcess] apiClient.uploadFile result.statistics.fileHeaders VALUE:", result.statistics.file_headers);
                setProcessingResult(result); 
                if(result.importRecord) setActiveImportData(prev => ({...prev, ...result.importRecord}));

                const headersFromApi = result.statistics.file_headers;
                if (Array.isArray(headersFromApi)) {
                    setFileHeaders(headersFromApi); // This will trigger useEffect to call initializeMappingTable & validation
                } else {
                    setFileHeaders([]); // Trigger useEffect for re-initialization without headers
                    message.error('Заголовки столбцов не были получены.');
                }

                if (result.statistics.error_summary) {
                    setProcessingErrorDetails(result.statistics.error_summary);
                } else {
                    setProcessingErrorDetails(null);
                }
                message.success(result.message || 'Файл обработан сервером.');
                 // Логика перехода на следующий шаг (например,setCurrentStep(1) или (2)) должна быть в UI или вызываться явно
            } else {
                const errorMsg = result?.error || 'Ошибка при обработке файла: неверный ответ сервера.';
                message.error(errorMsg);
                setError(errorMsg);
            }
        } catch (err) {
            let errorMessageText = 'Не удалось загрузить файл.';
            if (err.message) errorMessageText = err.message;
            message.error(errorMessageText);
            setError(errorMessageText);
        } finally {
            setUploading(false);
            // setUploadProgress(100); // Let it be managed by actual progress
        }
    }, [selectedFile, activeImportId, selectedFieldMapping]);


    // useEffect to perform validation after fileHeaders or originalMappingRules change
    useEffect(() => {
        // Валидация запускается только если есть правила и результат обработки файла (содержащий fileHeaders)
        if (originalMappingRules && processingResult && processingResult.statistics && processingResult.statistics.file_headers) {
            console.log("[useDataImportProcess] useEffect for validation. OriginalMappingRules:", originalMappingRules, "FileHeaders from processingResult:", processingResult.statistics.file_headers);
            const status = getFieldValidationStatus(originalMappingRules, processingResult.statistics.file_headers);
            setValidationStatus(status);
            console.log("[useDataImportProcess] Validation status SET:", status);
        } else {
            // Если нет результата обработки (например, файл еще не загружен или была ошибка до статистики)
            // или нет правил, то сбрасываем или устанавливаем начальный статус валидации.
            // Важно не показывать ошибку "поля не найдены", если файл еще не анализировался.
            console.log("[useDataImportProcess] useEffect for validation (else/resetting). ORM:", originalMappingRules, "PR:", processingResult);
            setValidationStatus(null); // Сбрасываем, если нет данных для валидации
        }
    }, [originalMappingRules, processingResult]); // Зависит от originalMappingRules и processingResult


    const handleMappingRuleChange = useCallback((index, fieldName, value) => {
        const updatedRules = [...currentMappingRules];
        updatedRules[index] = { ...updatedRules[index], [fieldName]: value };
        if (fieldName === 'targetField') {
            updatedRules[index].processing = { function: 'NONE', params: {} };
        }
        setCurrentMappingRules(updatedRules);
    }, [currentMappingRules]);

    const initiateAndProceed = useCallback(async () => {
        if (!selectedClient || !selectedFieldMapping) {
            message.error('Выберите клиента и шаблон маппинга.'); return false;
        }
        setUploading(true);
        try {
            const payload = {
                client_id: selectedClient,
                field_mapping_id: selectedFieldMapping,
                custom_name: customImportName || `Импорт от ${new Date().toLocaleString()}`,
            };
            const newImportRecord = await apiClient.initiateImport(payload);
            message.success(`Сессия импорта #${newImportRecord.id} успешно создана.`);
            setActiveImportId(newImportRecord.id);
            setActiveImportData(newImportRecord);
            setIsCreatingNewImport(false); 
            // originalMappingRules и initializeMappingTable вызываются через useEffect
            setCurrentStep(1);
            await fetchImports();
            return true;
        } catch (error) {
            message.error(error.message || 'Ошибка создания сессии импорта.');
            return false;
        } finally {
            setUploading(false);
        }
    }, [selectedClient, selectedFieldMapping, customImportName, fetchImports]);


    const executeFinalImport = useCallback(async () => {
        if (!activeImportId) {
            message.error('ID активного импорта отсутствует.'); return false;
        }
        const mappedRules = currentMappingRules.filter(r => r.targetField && r.sourceField);
        if (mappedRules.length === 0) {
            message.error('Нет настроенных правил сопоставления.'); return false;
        }
        // Проверка на незамапленные обязательные поля системы
        const systemRequiredFields = globalThis.targetFieldMappings?.filter(tf => tf.required).map(tf => tf.key) || []; // Осторожно с globalThis
        const mappedTargetKeys = mappedRules.map(r => r.targetField);
        const missingSystemReq = systemRequiredFields.filter(key => !mappedTargetKeys.includes(key));

        if (missingSystemReq.length > 0) {
            // const missingNames = missingSystemReq.map(key => globalThis.targetFieldMappings.find(tf => tf.key === key)?.name || key).join(', ');
            // message.error(`Не сопоставлены обязательные системные поля: ${missingNames}. Запуск импорта невозможен.`);
            // return false; 
            // Пока что разрешим, но с предупреждением, т.к. targetFieldMappings не передается в хук напрямую
             console.warn("Проверка на обязательные системные поля пропущена в хуке executeFinalImport из-за отсутствия прямого доступа к targetFieldMappings");
        }


        setFinalizingImport(true);
        setError(null);
        try {
            const finalRulesForApi = mappedRules.map(rule => ({
                target_field: rule.targetField,
                source_field: rule.sourceField,
                default_value: rule.defaultValue,
                processing: rule.processing,
            }));

            const result = await apiClient.executeImport(activeImportId, { mapping_rules: finalRulesForApi });
            message.success(result.message || `Импорт ${activeImportData?.custom_name || activeImportId} успешно запущен.`);
            if (result.importRecord) {
                setActiveImportData(result.importRecord); 
            }
            await fetchImports(); 
            setCurrentStep(3);
            return true;
        } catch (err) {
            const errorMessageText = err.response?.data?.error || err.message || `Ошибка при запуске импорта.`;
            message.error(errorMessageText);
            setError(errorMessageText);
            return false;
        } finally {
            setFinalizingImport(false);
        }
    }, [activeImportId, currentMappingRules, activeImportData, fetchImports]);
    

    useEffect(() => {
        fetchImports();
        fetchClients();
    }, [fetchImports, fetchClients]);

    // Этот эффект больше не нужен здесь, если управление идет из компонента страницы
    // useEffect(() => {
    //     if (initialActiveImportId && !activeImportId) {
    //         // handleSelectImportFromHistory might be called by parent component if id comes from URL
    //     } else if (initialIsCreatingNew && !isCreatingNewImport) {
    //         // handleStartNewImport();
    //     }
    // }, [initialActiveImportId, initialIsCreatingNew, activeImportId, isCreatingNewImport, handleSelectImportFromHistory, handleStartNewImport]);

    const handleFileSelectedCallback = useCallback((file) => {
        setSelectedFile(file);
        // При выборе нового файла, также сбрасываем связанные состояния
        setFileHeaders([]); 
        setProcessingResult(null);
        setProcessingErrorDetails(null); // Также сбрасываем детали ошибок обработки
        setError(null); // Также сбросить общие ошибки, связанные с файлом
        // ValidationStatus обновится автоматически через useEffect [originalMappingRules, fileHeaders]
        // если fileHeaders станет пустым
    }, [setSelectedFile /* зависимости setFileHeaders, setProcessingResult, setError можно неявно считать учтенными React */]);

    const handlePrevStepCallback = useCallback(() => {
        setCurrentStep(prev => Math.max(0, prev - 1));
    }, [setCurrentStep]);

    return {
        currentStep, setCurrentStep,
        imports, isLoadingImports, 
        clients, isLoadingClients, 
        fieldMappings, isLoadingFieldMappings,

        activeImportId, activeImportData, 
        isCreatingNewImport, 

        selectedClient, handleClientChange,
        selectedFieldMapping, handleFieldMappingChange,
        customImportName, handleCustomImportNameChange,
        
        originalMappingRules, 
        currentMappingRules, handleMappingRuleChange, setCurrentMappingRules, 

        selectedFile, handleFileChange, 
        fileHeaders, 
        
        uploading, uploadProgress,
        processingResult, 
        processingErrorDetails, 
        error, setError, 
        finalizingImport,
        validationStatus, 

        handleStartNewImport,
        handleSelectImportFromHistory,
        handleCancelActiveImport,
        initiateAndProceed, 
        handleFileUpload,    
        executeFinalImport,  
        
        // initializeMappingTable, // Сделаем внутренним для хука, если нет явной нужды вовне
        resetActiveImportStates,
        handleFileSelected: handleFileSelectedCallback,
        handlePrevStep: handlePrevStepCallback
    };
}; 