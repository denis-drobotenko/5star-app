import { Router } from 'express';
import { login, register, verify, requestPasswordReset, resetPassword } from '../controllers/authController.js';
const router = Router();
router.post('/login', login);
router.post('/register', register); // только для теста/первого пользователя
router.get('/verify', verify);
router.post('/request-password-reset', requestPasswordReset);
router.post('/reset-password', resetPassword);
export default router;
