import { targetFieldMappings } from '../../../shared/config/fieldMappingConstants';

export const formatMappingDateTime = (mappingItem) => {
    if (!mappingItem) return '';
    const dateString = mappingItem.createdAt || mappingItem.created_at;
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear()).slice(-2);
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `[${day}.${month}.${year} ${hours}:${minutes}]`;
    } catch (e) {
        console.error('Error formatting date for mapping item:', e);
        return '[Invalid Date]';
    }
};

export const getSystemFieldName = (key) => {
    if (!key) return 'Неопределенное поле';
    const field = targetFieldMappings.find(f => f.key === key); 
    return field ? field.name : key; 
};

export const getFieldValidationStatus = (originalRules, fileHeaders) => {
    if (!originalRules || !Array.isArray(originalRules)) {
        console.warn('[getFieldValidationStatus] originalRules is not an array or undefined', originalRules);
        return {
            foundFields: [],
            missingFields: [],
            unusedFileHeaders: Array.isArray(fileHeaders) ? [...fileHeaders] : [],
            allRequiredFound: true, 
            errorMessages: []
        };
    }
    if (!Array.isArray(fileHeaders)) {
        console.warn('[getFieldValidationStatus] fileHeaders is not an array or undefined', fileHeaders);
        fileHeaders = []; // Default to empty array if not provided correctly
    }

    const foundFields = [];
    const missingFields = [];
    const templateSourceFields = new Set();
    const errorMessages = [];

    originalRules.forEach(rule => {
        if (rule.source_field) {
            templateSourceFields.add(rule.source_field);
            const systemFieldName = getSystemFieldName(rule.target_field);
            if (fileHeaders.includes(rule.source_field)) {
                foundFields.push({ 
                    templateField: rule.source_field, 
                    systemField: systemFieldName
                });
            } else {
                missingFields.push({ 
                    templateField: rule.source_field, 
                    systemField: systemFieldName
                });
                // Формируем сообщение об ошибке только если поле действительно отсутствует
                errorMessages.push(`Обязательное по шаблону поле "${rule.source_field}" (для системного поля "${systemFieldName}") отсутствует в файле.`);
            }
        }
    });

    const unusedFileHeaders = fileHeaders.filter(header => !templateSourceFields.has(header));
    
    // Считаем, что все обязательные поля найдены, если список missingFields пуст.
    // Для более точной проверки нужно знать, какие из target_field являются truly required by the system.
    const allRequiredFound = missingFields.length === 0;

    return {
        foundFields,
        missingFields,
        unusedFileHeaders,
        allRequiredFound,
        errorMessages
    };
}; 