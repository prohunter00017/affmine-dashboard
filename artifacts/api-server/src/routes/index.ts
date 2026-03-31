/** Top-level API router — mounts all sub-routers under /api. */

import { Router, type IRouter } from "express";
import healthRouter from "./health";
import campaignsRouter from "./campaigns";

const router: IRouter = Router();

router.use(healthRouter);
router.use(campaignsRouter);

export default router;
