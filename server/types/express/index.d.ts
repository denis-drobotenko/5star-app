import { TokenPayloadFromJwt } from "../../services/authService.js";
import { Multer } from 'multer'; // Импортируем Multer для типа файла

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayloadFromJwt; // user теперь TokenPayloadFromJwt | undefined
      file?: Multer.File;
      files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
    }
  }
}

// Удаляем AuthenticatedRequest, так как он больше не нужен в таком виде
// export interface AuthenticatedRequest extends Request {
//   user: TokenPayloadFromJwt; // Это было бы user!: TokenPayloadFromJwt, если бы мы были уверены
// }

export {}; 