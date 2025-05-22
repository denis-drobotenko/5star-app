import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Typography, Button, Space, Input, Select, message, Upload, Modal, Steps, Card, Spin, Alert, List, Empty, Tag, Descriptions, Form, Skeleton, Table, Row, Col, Layout, Radio, Progress } from 'antd';
import { UploadOutlined, FileExcelOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, EyeOutlined, PlayCircleOutlined, InfoCircleOutlined, PlusOutlined, InboxOutlined, SyncOutlined, HourglassOutlined, ExclamationCircleOutlined, ArrowRightOutlined, ArrowLeftOutlined, SaveOutlined, DeleteOutlined } from '@ant-design/icons';
import '../../../assets/forms.css';
import { targetFieldMappings, processingFunctions } from '../../../shared/config/fieldMappingConstants';
import moment from 'moment';
import { useDataImportProcess } from '../hooks/useDataImportProcess';
import { formatMappingDateTime, getSystemFieldName } from '../services/dataImportUtils';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { Step } = Steps;
const { Dragger } = Upload;
const { Content } = Layout;

const DataImportsPage = () => {
    const { importId: routeImportId } = useParams();
    const {
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
        selectedFile, 
        fileHeaders, 
        uploading, uploadProgress,
        processingResult, 
        processingErrorDetails, 
        error, 
        finalizingImport,
        validationStatus, 
        handleStartNewImport, 
        handleSelectImportFromHistory,
        handleCancelActiveImport,
        initiateAndProceed, 
        handleFileUpload,    
        executeFinalImport,  
        resetActiveImportStates,
        handleFileSelected,
        handlePrevStep
    } = useDataImportProcess(routeImportId);

    const [searchText, setSearchText] = useState('');
    const [filteredImports, setFilteredImports] = useState([]);

    useEffect(() => {
        setFilteredImports(
            imports.filter(imp => {
                const clientName = clients.find(c => c.id === imp.client_id)?.name || '';
                const importName = imp.custom_name || `Загрузка ID: ${imp.id}`;
                const searchTerm = searchText.toLowerCase();
                return importName.toLowerCase().includes(searchTerm) || clientName.toLowerCase().includes(searchTerm);
            })
        );
    }, [searchText, imports, clients]);

    const handleFileSelectionChange = (info) => {
        const file = info.fileList.length > 0 ? (info.fileList[info.fileList.length - 1].originFileObj || info.fileList[info.fileList.length - 1]) : null;
        if (handleFileSelected) {
            handleFileSelected(file);
        } else {
            console.error("Функция handleFileSelected не получена из хука useDataImportProcess");
        }
    };

    const mappingTableColumns = [
        {
            title: 'Целевое поле в системе', dataIndex: 'targetField', key: 'targetField', width: 250,
            render: (text, record, index) => (
                <Select showSearch placeholder="Выберите целевое поле" value={record.targetField}
                    onChange={(value) => handleMappingRuleChange(index, 'targetField', value)}
                    style={{ width: '100%' }}
                    filterOption={(input, option) => option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0}
                >
                    {targetFieldMappings.map(tf => <Option key={tf.key} value={tf.key} title={tf.name}>{tf.name} ({tf.key})</Option>)}
                </Select>)
        },
        {
            title: 'Исходное поле из файла', dataIndex: 'sourceField', key: 'sourceField', width: 250,
            render: (text, record, index) => (
                <Select showSearch placeholder="Выберите исходное поле" value={record.sourceField}
                    onChange={(value) => handleMappingRuleChange(index, 'sourceField', value)}
                    style={{ width: '100%' }}
                    filterOption={(input, option) => option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0}
                >
                    {fileHeaders.map(header => <Option key={header} value={header}>{header}</Option>)}
                </Select>)
        },
        {
            title: 'Функция обработки', dataIndex: 'processing', key: 'processing', width: 200,
            render: (processing, record) => {
                const func = processingFunctions[processing?.function || 'NONE'] || processingFunctions['NONE'];
                const paramsString = Object.entries(processing?.params || {}).map(([k, v]) => `${k}:${v}`).join(', ');
                return (
                    <Button type="link" style={{padding:0}} onClick={() => message.info(`Настройка функции для '${getSystemFieldName(record.targetField) || 'поля'}' (пока не реализовано)`)}>
                        {func.name} {paramsString && `(${paramsString})`}
                    </Button>
                );
            }
        },
        {
            title: 'Значение по умолчанию', dataIndex: 'defaultValue', key: 'defaultValue', width: 200,
            render: (text, record, index) => <Input placeholder="Если исходное пусто" value={record.defaultValue} onChange={(e) => handleMappingRuleChange(index, 'defaultValue', e.target.value)} />
        },
    ];

    const getStatusTag = (status) => {
        switch (status) {
            case 'completed': return <Tag icon={<CheckCircleOutlined />} color="success">Завершен</Tag>;
            case 'processing': return <Tag icon={<SyncOutlined spin />} color="processing">В обработке</Tag>;
            case 'pending': return <Tag icon={<HourglassOutlined />} color="default">Ожидает</Tag>;
            case 'failed': return <Tag icon={<CloseCircleOutlined />} color="error">Ошибка</Tag>;
            case 'partial': return <Tag icon={<ExclamationCircleOutlined />} color="warning">Частично</Tag>;
            default: return <Tag color="default">{status || 'Неизвестно'}</Tag>;
        }
    };

    const renderImportStepContent = () => {
        console.log('DataImportsPage: Rendering step content:', currentStep, 'Client:', selectedClient, 'File:', selectedFile?.name);
        if (!activeImportId && !isCreatingNewImport) return null; 
        if (isLoadingFieldMappings || (isLoadingClients && currentStep === 0 && isCreatingNewImport)) return <Skeleton active paragraph={{rows:5}}/>;

        switch (currentStep) {
            case 0: 
                return (
                    <Space direction="vertical" style={{ width: '100%' }} size="large">
                        <Form layout="vertical">
                            <Form.Item label="Клиент" required>
                                <Select showSearch placeholder="Выберите клиента" optionFilterProp="children"
                                    onChange={handleClientChange} value={selectedClient} loading={isLoadingClients}
                                    filterOption={(input, option) => option.children.toLowerCase().includes(input.toLowerCase())}
                                >
                                    {clients.map(client => (
                                        <Option key={client.id} value={client.id}>{client.name}</Option>
                                    ))}
                                </Select>
                            </Form.Item>
                            <Form.Item label="Шаблон маппинга" required>
                                <Select placeholder="Выберите шаблон" value={selectedFieldMapping} onChange={handleFieldMappingChange}
                                    loading={isLoadingFieldMappings} disabled={!selectedClient || isLoadingFieldMappings}
                                >
                                    {fieldMappings.map(m => (
                                        <Option key={m.id} value={m.id} title={`${formatMappingDateTime(m)} ${m.name}`}>
                                            {`${formatMappingDateTime(m)} ${m.name}`}
                                        </Option>
                                    ))}
                                </Select>
                                {selectedClient && fieldMappings.length === 0 && !isLoadingFieldMappings && 
                                    <Alert message="Нет шаблонов для клиента." type="info" showIcon style={{marginTop: '10px'}}/>
                                }
                            </Form.Item>
                            <Form.Item label="Имя импорта (необязательно)">
                                <Input placeholder="Например, 'Ежемесячная загрузка'" value={customImportName} onChange={handleCustomImportNameChange} />
                            </Form.Item>
                        </Form>
                    </Space>
                );
            case 1: 
                if (!activeImportId) return <Alert message="Создайте сессию импорта (Шаг 1)." type="warning" showIcon />;
                const fieldValidationResult = validationStatus;
                return (
                    <Space direction="vertical" style={{ width: '100%' }} size="large">
                        <Title level={4}>Загрузка файла и проверка</Title>
                        <Descriptions size="small" column={1} bordered>
                             <Descriptions.Item label="ID сессии">{activeImportId}</Descriptions.Item>
                             <Descriptions.Item label="Клиент">{clients.find(c => c.id === selectedClient)?.name || 'N/A'}</Descriptions.Item>
                             <Descriptions.Item label="Шаблон">{selectedFieldMapping ? (fieldMappings.find(fm => fm.id === selectedFieldMapping)?.name || 'N/A') : 'Не выбран'}</Descriptions.Item>
                             <Descriptions.Item label="Имя">{customImportName || `Импорт от ${new Date(activeImportData?.created_at || Date.now()).toLocaleString()}`}</Descriptions.Item>
                        </Descriptions>
                        <Form.Item label="Файл (XLSX, XLS, CSV)" required style={{marginTop: '16px'}}>
                            <Dragger name="file" multiple={false} beforeUpload={() => false} onChange={handleFileSelectionChange}
                                fileList={selectedFile ? [{...selectedFile, uid: selectedFile.name, name: selectedFile.name, status: 'done'}] : []}
                                accept=".xlsx,.xls,.csv"
                            >
                                <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                                <p className="ant-upload-text">Кликните или перетащите файл</p>
                            </Dragger>
                        </Form.Item>
                        {selectedFile && (
                             <Button type="primary" icon={<UploadOutlined />} onClick={handleFileUpload} loading={uploading}
                                style={{ marginTop: 8 }} disabled={!selectedFile || uploading || !selectedFieldMapping}
                            >
                                {uploading ? 'Обработка...' : 'Загрузить и проанализировать'}
                            </Button>
                        )}
                         {!selectedFieldMapping && selectedFile && (
                            <Alert message="Шаблон не выбран. Вернитесь на Шаг 1." type="error" showIcon style={{ marginTop: 16 }} />
                        )}
                        {error && <Alert message={error} type="error" showIcon style={{ marginTop: 16 }} />}
                        {processingResult?.message && (
                            <Alert message={processingResult.message} 
                                type={processingResult.importRecord?.status === 'processing_failed' || (fieldValidationResult && !fieldValidationResult.allRequiredFound) ? "warning" : "success"} 
                                showIcon style={{ marginTop: 16 }}
                            />
                        )}
                        {processingResult?.statistics && (
                             <Descriptions bordered column={1} size="small" style={{ marginTop: 16 }} title="Анализ файла (сервер)">
                                 <Descriptions.Item label="Статус">{activeImportData?.status || processingResult.importRecord?.status ||'N/A'}</Descriptions.Item>
                                 <Descriptions.Item label="Всего строк">{activeImportData?.total_rows_in_file || processingResult.statistics.total_rows_in_file || 'N/A'}</Descriptions.Item>
                                 <Descriptions.Item label="Успешно (предпросмотр)">{processingResult.statistics.successPreview || processingResult.statistics.rows_successfully_previewed || 0}</Descriptions.Item>
                                 <Descriptions.Item label="Ошибок (предпросмотр)">{processingResult.statistics.failedPreview || processingResult.statistics.failed_preview_rows || 0}</Descriptions.Item>
                             </Descriptions>
                         )}
                        {fieldValidationResult && (
                            <Card title="Проверка полей по шаблону" size="small" style={{marginTop: 24}}>
                                {fieldValidationResult.errorMessages.length > 0 && (
                                    <Alert message="Критично: Поля шаблона не найдены в файле!" type="error" showIcon style={{ marginBottom: 16 }}
                                        description={<List size="small" dataSource={fieldValidationResult.errorMessages} renderItem={item => <List.Item><Text type="danger">{item}</Text></List.Item>} />}
                                    />
                                )}
                                <Title level={5} style={{ marginTop: fieldValidationResult.errorMessages.length > 0 ? 16 : 0, marginBottom: 8 }}>Детализация:</Title>
                                {(() => {
                                    const templateSourceFields = originalMappingRules.map(rule => rule.source_field).filter(sf => sf && typeof sf === 'string' && sf.trim() !== '');
                                    const uniqueTemplateSourceFields = Array.from(new Set(templateSourceFields));
                                    if (uniqueTemplateSourceFields.length === 0 && originalMappingRules.length > 0) return <Paragraph type="secondary">В шаблоне нет полей для сопоставления.</Paragraph>;
                                    return (
                                        <List size="small" bordered dataSource={uniqueTemplateSourceFields} 
                                            renderItem={sourceField => {
                                                const isFound = fileHeaders.includes(sourceField);
                                                return (
                                                    <List.Item>
                                                        <Row style={{ width: '100%' }} align="middle">
                                                            <Col span={20}><Text code>{sourceField}</Text></Col>
                                                            <Col span={4} style={{ textAlign: 'right' }}>{isFound ? <Tag color="success">Найдено</Tag> : <Tag color="error">Не найдено</Tag>}</Col>
                                                        </Row>
                                                    </List.Item>
                                                );
                                            }}
                                        />
                                    );
                                })()}
                                {fieldValidationResult.unusedFileHeaders.length > 0 && (
                                    <>
                                        <Title level={5} style={{ marginTop: 24, marginBottom: 8 }}>Поля файла, не используемые в шаблоне:</Title>
                                        <List size="small" bordered dataSource={fieldValidationResult.unusedFileHeaders} renderItem={item => <List.Item><Text code>{item}</Text></List.Item>} />
                                    </>
                                )}
                            </Card>
                        )}
                    </Space>
                );
            case 2: 
                const previewSampleRows = processingResult?.statistics?.sample_rows;
                const totalSuccessfullyProcessedForPreview = processingResult?.statistics?.rows_successfully_previewed;
                const errorSummary = processingResult?.statistics?.error_summary;
                
                console.log('[DataImportsPage] Step 2 - previewSampleRows:', previewSampleRows, 'totalSuccessfullyProcessedForPreview:', totalSuccessfullyProcessedForPreview, 'errorSummary:', errorSummary);

                const errorTableColumns = [
                    { title: '№ строки', dataIndex: 'row_number_in_file', key: 'row_number_in_file', width: 100, sorter: (a,b) => a.row_number_in_file - b.row_number_in_file, defaultSortOrder: 'ascend' },
                    { title: 'Поле', dataIndex: 'field_name', key: 'field_name', width: 150, ellipsis: true },
                    { title: 'Значение', dataIndex: 'original_value', key: 'original_value', width: 200, ellipsis: true, render: (val) => String(val) },
                    { title: 'Тип ошибки', dataIndex: 'error_type', key: 'error_type', width: 150, ellipsis: true },
                    { title: 'Сообщение', dataIndex: 'error_message', key: 'error_message', ellipsis: true },
                ];
                const errorTableData = errorSummary?.detailed_errors?.map((err, idx) => ({ ...err, key: `error-${idx}` })) || [];

                const previewTableColumns = currentMappingRules
                    .filter(rule => rule.targetField && rule.sourceField) 
                    .map(rule => {
                        const columnDefinition = {
                            title: getSystemFieldName(rule.targetField),
                            dataIndex: rule.targetField, 
                            key: rule.targetField,
                            ellipsis: true,
                            width: 150,
                            render: (text, recordRow) => { 
                                const value = recordRow[rule.targetField]; 
                                if (value === null || value === undefined || String(value).trim() === '') return <Text type="secondary">N/A</Text>;
                                switch (rule.targetField) {
                                    case 'birthday': return moment(value).isValid() ? moment(value).format('DD.MM.YYYY') : String(value);
                                    case 'order_date': case 'delivery_date': return moment(value).isValid() ? moment(value).format('DD.MM.YYYY HH:mm') : String(value);
                                    default: return String(value);
                                }
                            }
                        };
                        if ([ 'quantity', 'revenue', 'cost_price', 'order_date', 'delivery_date', 'birthday', 'telephone'].includes(rule.targetField)) columnDefinition.align = 'right';
                        return columnDefinition;
                    });

                const previewTableData = Array.isArray(previewSampleRows) ? previewSampleRows.map((row, index) => ({ ...row, key: `preview-row-${index}` })) : [];
                console.log('[DataImportsPage] Step 2 - Preview Columns:', previewTableColumns, 'Preview Data:', previewTableData);

                if (!processingResult) return <Alert message="Результаты обработки отсутствуют." type="warning" showIcon />;
                
                const mappedTargetFieldsInStep2 = currentMappingRules.filter(r => r.targetField).map(r => r.targetField); 
                const missingRequiredSystemFieldsInStep2 = targetFieldMappings.filter(tf => tf.required && !mappedTargetFieldsInStep2.includes(tf.key));

                return (
                    <Space direction="vertical" style={{ width: '100%' }} size="large">
                        <Title level={4}>Предпросмотр и Ошибки</Title>
                        {errorSummary && errorSummary.total_errors > 0 && (
                            <Card title="Ошибки приведения типов" style={{ marginBottom: 24 }} type="inner">
                                <Alert
                                    message={`Ошибок: ${errorSummary.total_errors} в ${errorSummary.rows_with_errors} строках.`}
                                    description={<ul>{Object.entries(errorSummary.errors_by_type || {}).map(([type, count]) => (<li key={type}>{type}: {count}</li>))}</ul>}
                                    type="error" showIcon style={{ marginBottom: 16 }}
                                />
                                {errorTableData.length > 0 && (
                                    <>
                                        <Text strong>Детализация (первые {errorTableData.length} из {errorSummary.total_errors}):</Text>
                                        <Table columns={errorTableColumns} dataSource={errorTableData} size="small" bordered pagination={{ pageSize: 5, total: errorSummary.total_errors }} scroll={{ x: 'max-content' }} style={{ marginTop: 8 }} />
                                    </>
                                )}
                            </Card>
                        )}
                        <Card title="Предпросмотр обработанных данных" type="inner">
                            <Paragraph>Показаны первые строки с успешно распознанными данными. Отображаются <strong>только сопоставленные поля</strong>.</Paragraph>
                            {missingRequiredSystemFieldsInStep2.length > 0 && (
                                <Alert message="Внимание! Не сопоставлены обязательные поля" type="warning" showIcon style={{ marginBottom: 16 }}
                                    description={<span>Следующие поля не сопоставлены: <Text strong>{missingRequiredSystemFieldsInStep2.map(f => f.name).join(', ')}</Text>.</span>}
                                />
                            )}
                            {previewTableColumns.length === 0 && <Alert message="Нет сопоставленных полей." type="info" showIcon />}
                            {previewTableColumns.length > 0 && previewTableData.length === 0 && (!errorSummary || errorSummary.total_errors === 0) && (
                                 <Alert message="Нет данных для предпросмотра." type="info" showIcon 
                                    description="Возможно, все строки файла с ошибками или файл пуст."/>
                            )}
                            {previewTableColumns.length > 0 && previewTableData.length > 0 && (
                                <Table bordered size="small" dataSource={previewTableData} columns={previewTableColumns} 
                                    pagination={{ pageSize: 10, total: totalSuccessfullyProcessedForPreview || previewTableData.length, showSizeChanger: false }} 
                                    scroll={{ x: 'max-content' }} style={{ marginTop: 8 }}
                                />
                            )}
                            <Descriptions bordered column={1} size="small" style={{marginTop: 16}}>
                                <Descriptions.Item label="Клиент">{clients.find(c => c.id === selectedClient)?.name || 'N/A'}</Descriptions.Item>
                                <Descriptions.Item label="Файл">{selectedFile?.name || 'N/A'}</Descriptions.Item>
                                <Descriptions.Item label="Шаблон">{selectedFieldMapping ? (fieldMappings.find(m => m.id === selectedFieldMapping)?.name || 'N/A') : 'Ручные настройки'}</Descriptions.Item>
                                <Descriptions.Item label="Колонок в предпросмотре">{previewTableColumns.length}</Descriptions.Item>
                                <Descriptions.Item label="Строк в файле (сервер)">{processingResult?.statistics?.total_rows_in_file || 'N/A'}</Descriptions.Item>
                                <Descriptions.Item label="Успешно для предпросмотра (сервер)">{totalSuccessfullyProcessedForPreview || 'N/A'}</Descriptions.Item>
                                <Descriptions.Item label="Ошибок приведения типов (сервер)">{errorSummary?.total_errors || 0}</Descriptions.Item>
                            </Descriptions>
                        </Card>
                        <Alert message="Функции обработки и значения по умолчанию применены сервером." type="info" showIcon style={{ marginTop: 16 }} />
                    </Space>
                );
            case 3: 
                if (finalizingImport && (!activeImportData || activeImportData.status === 'processing' || activeImportData.status === 'pending_execution')) 
                    return <Spin tip="Выполнение импорта..." style={{display: 'block', margin: '50px auto'}}><div style={{padding: '50px'}} /></Spin>;
                if (!activeImportData) return <Alert message="Информация об импорте отсутствует." type="info" showIcon />;
                return (
                    <Card>
                        <Title level={4}>Результат импорта #{activeImportData.id}</Title>
                        <Descriptions bordered column={1} size="small">
                            <Descriptions.Item label="Статус">{getStatusTag(activeImportData.status)}</Descriptions.Item>
                            <Descriptions.Item label="Имя">{activeImportData.custom_name}</Descriptions.Item>
                            <Descriptions.Item label="Клиент">{clients.find(c => c.id === activeImportData.client_id)?.name}</Descriptions.Item>
                            <Descriptions.Item label="Файл">{activeImportData.file_name}</Descriptions.Item>
                            <Descriptions.Item label="Начало">{new Date(activeImportData.created_at).toLocaleString()}</Descriptions.Item>
                            <Descriptions.Item label="Обновление">{new Date(activeImportData.updated_at).toLocaleString()}</Descriptions.Item>
                            <Descriptions.Item label="Всего строк">{activeImportData.summary?.total_rows_in_file || 'N/A'}</Descriptions.Item>
                            <Descriptions.Item label="Успешно">{activeImportData.summary?.rows_successfully_imported || 0}</Descriptions.Item>
                            <Descriptions.Item label="Ошибок">{activeImportData.summary?.rows_failed || 0}</Descriptions.Item>
                            <Descriptions.Item label="Пропущено">{activeImportData.summary?.rows_skipped || 0}</Descriptions.Item>
                        </Descriptions>
                        {activeImportData.status_details && (
                            <Alert message="Детали статуса" description={<pre>{typeof activeImportData.status_details === 'string' ? activeImportData.status_details : JSON.stringify(activeImportData.status_details, null, 2)}</pre>} type="info" style={{marginTop: '16px'}}/>
                        )}
                        {activeImportData.summary?.errors && activeImportData.summary.errors.length > 0 && (
                            <div style={{marginTop: '16px'}}>
                                <Title level={5}>Ошибки (первые 10):</Title>
                                <List size="small" bordered dataSource={activeImportData.summary.errors.slice(0, 10)}
                                    renderItem={(item, index) => <List.Item>Строка {item.rowNumberInFile || 'N/A'}: {item.message || JSON.stringify(item)}</List.Item>}
                                />
                                {activeImportData.summary.errors.length > 10 && <Text type="secondary">Показаны 10 из {activeImportData.summary.errors.length}.</Text>}
                            </div>
                        )}
                         <Button style={{marginTop: '20px'}} onClick={() => { handleCancelActiveImport(); fetchImports(); }}>К списку / Начать новый</Button>
                    </Card>
                );
            default:
                return <Alert message="Неизвестный шаг." type="error" showIcon />;
        }
    };
    
    const renderImportStepFooter = () => {
        if (currentStep === 2) {
            console.log('[DataImportsPage][FooterDebug] Step 2 Button States:', { finalizingImport, previewSampleRowsCount: processingResult?.statistics?.sample_rows?.length, currentMappingRulesLength: currentMappingRules.length, mappedTargetFieldsCount: currentMappingRules.filter(r => r.targetField).length });
        }

        let primaryAction = null;
        const isStep0NextDisabled = !selectedClient || !selectedFieldMapping || (fieldMappings.length === 0 && !isCreatingNewImport);
        let actualIsStep1NextDisabled = true;

        if (currentStep === 1) {
            const condSelectedFile = !selectedFile;
            const condUploading = uploading;
            const condFileHeadersNotReady = !processingResult || 
                                          !processingResult.statistics || 
                                          !Array.isArray(processingResult.statistics.file_headers) || 
                                          processingResult.statistics.file_headers.length === 0;
            const condActiveImportDataId = !activeImportData?.id;
            const condNoSelectedMapping = !selectedFieldMapping; 
            const templateFieldsMissingInFile = validationStatus?.errorMessages?.length > 0 && validationStatus?.missingFields?.length > 0;

            actualIsStep1NextDisabled = condSelectedFile || 
                                        condUploading || 
                                        condFileHeadersNotReady || 
                                        condActiveImportDataId || 
                                        condNoSelectedMapping || 
                                        templateFieldsMissingInFile; 

            console.log('[DataImportsPage][FooterDebug] Step 1 Next Button State:', { actualIsStep1NextDisabled, details: { condSelectedFile, condUploading, condFileHeadersNotReady, condActiveImportDataId, condNoSelectedMapping, templateFieldsMissingInFile, validationStatus } });
        }

        if (currentStep === 0) {
            primaryAction = <Button type="primary" onClick={initiateAndProceed} loading={uploading} disabled={isStep0NextDisabled || uploading}>Далее</Button>;
        } else if (currentStep === 1) {
            primaryAction = <Button type="primary" onClick={() => setCurrentStep(2)} loading={finalizingImport || uploading} disabled={actualIsStep1NextDisabled || uploading}>Далее</Button>;
        } else if (currentStep === 2) {
            primaryAction = <Button type="primary" onClick={executeFinalImport} loading={finalizingImport} disabled={finalizingImport}>Запустить импорт</Button>;
        } else if (currentStep === 3) {
            primaryAction = <Button type="primary" onClick={() => { handleCancelActiveImport(); fetchImports();}}>Завершить</Button>;
        }

        return (
            <Space style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid #f0f0f0', width: '100%', justifyContent: 'space-between' }}>
                <div>{currentStep > 0 && <Button onClick={handlePrevStep} disabled={uploading || finalizingImport || (currentStep === 1 && !activeImportId) }>Назад</Button>}</div>
                <div>{primaryAction}</div>
            </Space>
        );
    };

    if (isLoadingImports && imports.length === 0 && clients.length === 0 && !activeImportId && !isCreatingNewImport) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 150px)' }}><Spin size="large" tip="Загрузка данных..." /></div>;
    }
    
    return (
        <div className="list-detail-layout" style={{ height: '100%' }}>
            <div className="list-container">
                <div className="list-header">
                    <Title level={4} style={{ margin: 0, flex: 1 }}>Загрузки данных</Title>
                    <Button className="add-list-item-button" type="primary" size="small" onClick={handleStartNewImport}>Добавить</Button>
                </div>
                <Input.Search placeholder="Поиск" allowClear value={searchText} onChange={e => setSearchText(e.target.value)} style={{ margin: '0 0 16px 0', width: '100%' }}/>
                <div className="list-scroll-area">
                    {isLoadingImports && imports.length === 0 ? <Skeleton active paragraph={{ rows: 8 }} />
                     : filteredImports.length === 0 ? <Empty description={searchText ? "Не найдено" : "Нет загрузок."} style={{marginTop: '30px'}}/>
                     : <List itemLayout="horizontal" dataSource={filteredImports} pagination={{ pageSize: 10, size: "small", showSizeChanger: false }} renderItem={item => {
                            const clientName = clients.find(c => c.id === item.client_id)?.name || 'N/A';
                            const isSelected = activeImportId === item.id && !isCreatingNewImport; 
                            let titleText = item.custom_name || `Загрузка от ${new Date(item.created_at).toLocaleDateString()}`;
                            return (
                                <div key={item.id} onClick={() => handleSelectImportFromHistory(item)} className={`list-item data-import-list-item ${isSelected ? 'selected' : ''}`}>
                                    <div className="list-item-content-wrapper">
                                        <span className="list-item-line1" title={titleText}>{titleText}</span>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                            <Typography.Text className="list-item-line2" style={{ flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`Клиент: ${clientName}`}>
                                                Клиент: {clientName}
                                            </Typography.Text>
                                            <Typography.Text type="secondary" style={{ whiteSpace: 'nowrap', marginLeft: '8px', fontSize: '11px' }}>
                                                {new Date(item.created_at).toLocaleDateString([], {day:'2-digit', month:'2-digit', year:'2-digit'})} {new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </Typography.Text>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: '2px' }}>
                                            {getStatusTag(item.status)}
                                            {item.summary?.total_rows_in_file !== undefined && 
                                                <Text style={{fontSize: '0.8em'}} type="secondary">
                                                    ({item.summary.rows_successfully_imported !== undefined ? item.summary.rows_successfully_imported : (item.summary.rows_processed || 0)} / {item.summary.total_rows_in_file})
                                                </Text>}
                                        </div>
                                    </div>
                                </div>
                            );
                        }} />
                    }
                </div>
            </div>
            <div className="detail-pane">
                {(!activeImportId && !isCreatingNewImport) ? (
                    <div className="detail-pane-instruction" style={{ paddingLeft: '24px' }}> 
                        <InfoCircleOutlined />
                        <p>Выберите загрузку или нажмите «Добавить».</p>
                    </div>
                ) : (
                    <>
                        <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Title level={4} style={{ margin: 0 }}>
                                {isCreatingNewImport ? 'Новая загрузка' : activeImportData ? (activeImportData.custom_name || `ID: ${activeImportData.id}`) : 'Детали'}
                            </Title>
                             { (activeImportId || isCreatingNewImport) && currentStep < 3 && (
                                <Button onClick={handleCancelActiveImport}>Отмена</Button>
                            )}
                        </div>
                        <div style={{ padding: '24px', height: 'calc(100% - 72px - 73px)', overflowY: 'auto' }}>
                            <Steps current={currentStep} style={{ marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid #f0f0f0' }}>
                                <Step title="Настройка" description="Клиент, шаблон, имя" />
                                <Step title="Файл и поля" description="Загрузка и проверка" />
                                <Step title="Предпросмотр" description="Проверка данных" />
                                <Step title="Результат" description="Итоги" />
                            </Steps>
                            <div style={{ marginTop: 0 }}> 
                                {renderImportStepContent()}
                            </div>
                        </div>
                        <div className="form-footer" style={{ padding: '16px 24px' }}> 
                             {renderImportStepFooter()}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default DataImportsPage; 