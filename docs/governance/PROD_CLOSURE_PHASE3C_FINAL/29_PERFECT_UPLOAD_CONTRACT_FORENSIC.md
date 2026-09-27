# 29 — Perfect Upload Contract Forensic

Task: `MIRA-P3C-FINAL-ACCEPTANCE-2026-08-31`  
Source candidate: `4b2c78ac42fef38dc0012a35ba6879ae4d6a4a74`

## Current source contract

`PerfectCorpService.analyzeSkin()` executes:

1. `POST {baseUrl}/file/skin-analysis`;
2. extract `data.files[0].file_id` and `requests[0]`;
3. upload bytes to the returned presigned URL;
4. `POST {baseUrl}/task/skin-analysis`;
5. poll `GET {baseUrl}/task/skin-analysis/{taskId}`;
6. map provider concerns to `SkinAnalysisResult`.

The upload implementation uses:

| Property | Contract |
|---|---|
| HTTP implementation | Node global `fetch` |
| scheme | `https` |
| observed hostname | `yce-us.s3-accelerate.amazonaws.com` |
| method | provider `request.method`, default `PUT` |
| safe header names | `content-type`, `content-length`, plus provider-returned header names |
| body | `Uint8Array(imageBytes)` |
| redirects | fetch default |
| TLS/DNS | Node/undici defaults |
| upload timeout | none explicitly configured |
| upload `AbortController` | none |
| upload response | any non-2xx throws `S3 upload {status}` |
| service retry | none |
| wrapper retry | image variants only for classified face-quality errors |

No signed query parameters, credentials, authorization values, or full
presigned URLs were recorded.

## Contract assessment

The same request contract completed successfully from Render. Therefore the
method, headers, body, redirect and TLS contract are accepted by the provider.

`PERFECT UPLOAD CONTRACT = PASS`

The two workstation `fetch failed` observations are not evidence of a request
contract defect.

## Runtime capability

Render supports one-off jobs against the already deployed `mira-api` image.
The job inherited existing production environment variables and executed
deployed commit `dca189cdd42f73d63ac3a4ac3ee00471151c6e98`. No candidate deployment,
service source change, database mutation, or production flag change occurred.

`RENDER_RUNTIME_AVAILABLE`
