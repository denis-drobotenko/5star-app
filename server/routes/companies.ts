import { Router } from 'express';
import * as companyController from '../controllers/companyController.js';
import { validateBody, validateParams, validateQuery, companyIdSchema, getAllCompaniesSchema, createCompanySchema, updateCompanySchema } from '../../shared/validators/companyValidator.js';

const router = Router();

router.get('/', validateQuery(getAllCompaniesSchema), companyController.getAll);
router.get('/:id', validateParams(companyIdSchema), companyController.getById);
router.post('/', validateBody(createCompanySchema), companyController.create);
router.put('/:id', validateParams(companyIdSchema), validateBody(updateCompanySchema), companyController.update);
router.delete('/:id', validateParams(companyIdSchema), companyController.remove);

export default router; 