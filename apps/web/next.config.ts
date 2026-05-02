import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Inclui arquivos do agent Python no bundle do servidor pra montar o .zip de
  // download em /api/accounts. Sem isso o Vercel não copia apps/agent/ no deploy.
  outputFileTracingIncludes: {
    "/api/accounts/**": [
      "../agent/agent.py",
      "../agent/ingest_client.py",
      "../agent/import_history.py",
      "../agent/requirements.txt",
      "../agent/sources/**/*.py",
    ],
  },
};

export default nextConfig;
