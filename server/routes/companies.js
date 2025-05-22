const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');

router.get('/', companyController.getAll);
router.get('/:id', companyController.getById);
router.post('/', companyController.create);
router.put('/:id', companyController.update);
router.delete('/:id', companyController.remove);

module.exports = router; 