import express from 'express';
import {
  getOrganizations,
  getIssuers,
  getIssuerById,
  registerIssuer,
} from '../controllers/organizationController.js';

const router = express.Router();

router.get('/organizations', getOrganizations);
router.get('/issuers', getIssuers);
router.get('/issuers/:id', getIssuerById);
router.post('/issuers/register', registerIssuer);

export default router;
