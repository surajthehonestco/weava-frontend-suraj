const fs = require('fs');
const path = require('path');
const http = require('http');
const { URL } = require('url');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');

const PORT = Number(process.env.LEGACY_PDF_PROXY_PORT || 4301);
const ENVIRONMENT_FILE = path.resolve(__dirname, '../src/environments/environment.ts');

const sendJson = (res, status, payload) => {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': '*'
  });
  res.end(JSON.stringify(payload));
};

const extractField = (content, fieldName) => {
  const match = content.match(new RegExp(`${fieldName}\\s*:\\s*'([^']*)'`));
  return match?.[1] || '';
};

const loadAwsConfig = () => {
  const content = fs.readFileSync(ENVIRONMENT_FILE, 'utf8');

  return {
    accessKeyId: extractField(content, 'accessKey'),
    secretAccessKey: extractField(content, 'secretKey'),
    bucketName: extractField(content, 'bucketName'),
    region: extractField(content, 'region')
  };
};

const awsConfig = loadAwsConfig();

const s3Client = awsConfig.accessKeyId && awsConfig.secretAccessKey && awsConfig.bucketName && awsConfig.region
  ? new S3Client({
      region: awsConfig.region,
      credentials: {
        accessKeyId: awsConfig.accessKeyId,
        secretAccessKey: awsConfig.secretAccessKey
      }
    })
  : null;

const streamPdfResponse = async (res, body, contentType) => {
  const bytes = await body.transformToByteArray();
  res.writeHead(200, {
    'Content-Type': contentType || 'application/pdf',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store'
  });
  res.end(Buffer.from(bytes));
};

const tryFetchSource = async (source) => {
  const upstream = await fetch(source, { method: 'GET' });
  if (!upstream.ok) {
    const text = await upstream.text();
    return {
      ok: false,
      status: upstream.status,
      body: text.slice(0, 1000),
      contentType: upstream.headers.get('content-type') || ''
    };
  }

  return {
    ok: true,
    response: upstream,
    contentType: upstream.headers.get('content-type') || ''
  };
};

const getLegacyIdFromSource = (source) => {
  try {
    const parsed = new URL(source);
    const segments = parsed.pathname.split('/').filter(Boolean);
    return segments[segments.length - 1] || '';
  } catch {
    return '';
  }
};

const buildCandidateKeys = (legacyId) => {
  if (!legacyId) return [];

  return [
    `pdf/${legacyId}.pdf`,
    `pdf/${legacyId}`,
    legacyId,
    `${legacyId}.pdf`,
    `pdfstorage/${legacyId}`,
    `pdfstorage/${legacyId}.pdf`
  ];
};

const tryFetchFromS3 = async (source) => {
  if (!s3Client) {
    return {
      ok: false,
      error: 'AWS config missing in src/environments/environment.ts'
    };
  }

  const legacyId = getLegacyIdFromSource(source);
  const candidateKeys = buildCandidateKeys(legacyId);
  const failures = [];

  for (const key of candidateKeys) {
    try {
      const response = await s3Client.send(
        new GetObjectCommand({
          Bucket: awsConfig.bucketName,
          Key: key
        })
      );

      return {
        ok: true,
        key,
        response
      };
    } catch (error) {
      failures.push({
        key,
        message: error instanceof Error ? error.message : 'Unknown S3 error'
      });
    }
  }

  return {
    ok: false,
    error: 'S3 object not found with tried keys',
    legacyId,
    triedKeys: failures
  };
};

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    return sendJson(res, 400, { error: 'Missing request URL' });
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': '*'
    });
    return res.end();
  }

  const requestUrl = new URL(req.url, `http://localhost:${PORT}`);

  if (requestUrl.pathname !== '/legacy-pdf') {
    return sendJson(res, 404, { error: 'Not found' });
  }

  const source = requestUrl.searchParams.get('source');
  if (!source) {
    return sendJson(res, 400, { error: 'Missing source query parameter' });
  }

  try {
    const upstream = await tryFetchSource(source);

    if (upstream.ok) {
      const contentType = upstream.contentType || 'application/pdf';
      return streamPdfResponse(res, upstream.response.body, contentType);
    }

    const s3Result = await tryFetchFromS3(source);
    if (s3Result.ok) {
      const contentType = s3Result.response.ContentType || 'application/pdf';
      return streamPdfResponse(res, s3Result.response.Body, contentType);
    }

    return sendJson(res, 502, {
      error: 'Legacy PDF could not be loaded from source URL or S3',
      upstream,
      s3: s3Result
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: 'Legacy PDF proxy failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

server.listen(PORT, () => {
  console.log(`Legacy PDF proxy listening on http://localhost:${PORT}`);
  console.log(`AWS bucket configured: ${awsConfig.bucketName ? 'yes' : 'no'}`);
});
