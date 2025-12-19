import dotenv from "dotenv";
import { loadConfig } from "./shared/config";

dotenv.config();

export const CONFIG = loadConfig();
