import {isProd} from "../common/config.ts";

export const API_BASE_URL = isProd
  ? 'https://api.example.com'
  : 'http://localhost:3000/api'
