import { Router } from "express";
import { uploadSingleImage } from "../../middleware/multer";
import { UploadController } from "./upload.controller";

const router = Router();

// Endpoint: POST /api/v1/upload/image
// Handles multipart/form-data with field name "image"
router.post("/image", uploadSingleImage, UploadController.uploadImage);

export const UploadRoutes = router;
