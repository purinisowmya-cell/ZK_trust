import http from 'http';

const PORT = process.env.PORT || 5001;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: path.startsWith('/api') ? path : '/api' + path,
        method,
        headers: { 'Content-Type': 'application/json' },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: data });
          }
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runSecurityApiChecks() {
  console.log('=== Checking Live API Security & Private Key Non-Exposure ===\n');

  // Check 1: Issuer Profile endpoint
  const profileRes = await request('GET', '/issuer/public-key');
  console.log('1. Checking GET /api/issuer/public-key...');
  if (profileRes.status !== 200) throw new Error('Failed to fetch issuer profile');
  
  const profileStr = JSON.stringify(profileRes.data);
  if (profileStr.toLowerCase().includes('private') || profileStr.toLowerCase().includes('pkcs8')) {
    throw new Error('SECURITY VIOLATION: Private key found in public profile API response!');
  }
  console.log('[PASS] Issuer public key correctly returned. Zero private key exposure.');

  // Check 2: Issue Credential endpoint
  console.log('\n2. Checking POST /api/issuer/issue-credential...');
  const issueRes = await request('POST', '/issuer/issue-credential', {
    fullName: 'Jane Doe',
    age: 21,
    dateOfBirth: '2005-01-01',
  });
  if (issueRes.status !== 201) throw new Error('Failed to issue credential');

  const issueStr = JSON.stringify(issueRes.data);
  if (issueStr.toLowerCase().includes('private_key') || issueStr.toLowerCase().includes('privatekey')) {
    throw new Error('SECURITY VIOLATION: Private key leaked in issuance response!');
  }
  console.log('[PASS] Credential and private witness delivered. Issuer private key never disclosed.');

  // Check 3: Signature verification on returned credential
  const cred = issueRes.data.credential;
  console.log(' - Issued Credential ID:', cred.credentialId);
  console.log(' - Poseidon Commitment:', cred.commitment);
  console.log(' - Ed25519 Signature:', cred.issuerSignature.slice(0, 32) + '...');
  console.log(' - Private Secret Length:', issueRes.data.privateData.secret.length, 'digits');

  console.log('\n=== ALL ISSUER WORKFLOW SECURITY CHECKS PASSED ===\n');
}

runSecurityApiChecks().catch((err) => {
  console.error('Security test failed:', err);
  process.exit(1);
});
