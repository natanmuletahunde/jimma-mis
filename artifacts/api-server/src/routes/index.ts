import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import propertiesRouter from "./properties";
import photosRouter from "./photos";
import dashboardRouter from "./dashboard";
import mapRouter from "./map";
import reportsRouter from "./reports";
import locationsRouter from "./locations";
import auditLogsRouter from "./audit-logs";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(propertiesRouter);
router.use(photosRouter);
router.use(dashboardRouter);
router.use(mapRouter);
router.use(reportsRouter);
router.use(locationsRouter);
router.use(auditLogsRouter);

export default router;
