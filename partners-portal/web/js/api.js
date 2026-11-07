(function () {
  const meta = document.querySelector('meta[name="mira-api-base"]');
  const API_BASE = localApiBase(
    (meta && meta.getAttribute('content')) ||
    'https://mira-api-n4p3.onrender.com/api/v1',
  );

  const AUTH_GEN_KEY = 'mira_auth_generation';

  function readAuthGeneration() {
    const n = Number(sessionStorage.getItem(AUTH_GEN_KEY) || '0');
    return Number.isFinite(n) ? n : 0;
  }

  let authGeneration = readAuthGeneration();

  function bumpAuthGeneration(reason) {
    authGeneration = readAuthGeneration() + 1;
    sessionStorage.setItem(AUTH_GEN_KEY, String(authGeneration));
    try {
      localStorage.removeItem('mira_partner_id');
    } catch (e) {}
    try {
      window.dispatchEvent(
        new CustomEvent('mira:auth-change', {
          detail: {
            reason: reason || 'auth',
            authGeneration: authGeneration,
            hasToken: !!localStorage.getItem('mira_partner_token'),
          },
        }),
      );
    } catch (e) {}
    return authGeneration;
  }

  function authTokenFingerprint() {
    const t = localStorage.getItem('mira_partner_token');
    if (!t) return null;
    return String(t.length) + ':' + t.slice(0, 16);
  }

  function localApiBase(fallback) {
    const override = new URLSearchParams(location.search).get('api-base');
    const localPage = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
    if (localPage && override && /^https?:\/\/(127\.0\.0\.1|localhost):\d+(?:\/.*)?$/.test(override)) {
      return override.replace(/\/$/, '');
    }
    return fallback;
  }

  function authHeaders() {
    const token = localStorage.getItem('mira_partner_token');
    return token
      ? { Authorization: `Bearer ${token}` }
      : {};
  }

  function labeledPreview() {
    return new URLSearchParams(location.search).get('ui-fixture') === 'labeled';
  }

  function ApiError(message, meta) {
    const err = new Error(message);
    err.name = 'PartnersApiError';
    err.messageAr = message;
    if (meta) {
      err.status = meta.status;
      err.code = meta.code;
      err.fieldErrors = meta.fieldErrors || null;
      err.body = meta.body || null;
      if (meta.body && meta.body.messageAr) err.messageAr = meta.body.messageAr;
    }
    return err;
  }

  async function request(method, path, body, extraHeaders, opts) {
    if (labeledPreview()) {
      throw ApiError('محاكاة: لم يُرسل طلب ولم تُستخدم الجلسة');
    }
    const signal = opts && opts.signal;
    const tokenAtStart = localStorage.getItem('mira_partner_token');
    const authGenAtStart = authGeneration;
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(extraHeaders || {}),
        ...authHeaders(),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: signal || undefined,
    });
    // Read body first, then re-check session — a mid-body account switch must not apply data.
    const data = await res.json().catch(() => ({}));
    if (
      localStorage.getItem('mira_partner_token') !== tokenAtStart ||
      authGeneration !== authGenAtStart
    ) {
      throw ApiError('تبديل جلسة أثناء الطلب — تُجاهل الاستجابة', { code: 'AUTH_CHANGED' });
    }
    if (!res.ok) {
      const msg = data.message || data.error || `HTTP ${res.status}`;
      throw ApiError(Array.isArray(msg) ? msg.join(' ') : msg, {
        status: res.status,
        code: data.code || null,
        fieldErrors: data.fieldErrors || null,
        body: data,
      });
    }
    return data;
  }

  function requestProgress(method, path, body, hooks) {
    if (labeledPreview()) {
      return Promise.reject(ApiError('محاكاة: لم يُرسل طلب ولم تُستخدم الجلسة'));
    }
    const notify = hooks || {};
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const fail = (error) => reject(error);
      if (notify.signal) {
        if (notify.signal.aborted) {
          fail(Object.assign(new Error('أُلغي الرفع'), { name: 'AbortError' }));
          return;
        }
        notify.signal.addEventListener('abort', () => xhr.abort(), { once: true });
      }
      xhr.open(method, `${API_BASE}${path}`);
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.setRequestHeader('Content-Type', 'application/json');
      const headers = authHeaders();
      Object.keys(headers).forEach((key) => xhr.setRequestHeader(key, headers[key]));
      xhr.upload.onprogress = (event) => {
        if (typeof notify.onProgress !== 'function') return;
        if (event.lengthComputable && event.total > 0) notify.onProgress(event.loaded / event.total);
        else notify.onProgress(null);
      };
      xhr.upload.onload = () => {
        if (typeof notify.onProcessing === 'function') notify.onProcessing();
      };
      xhr.onabort = () => fail(Object.assign(new Error('أُلغي الرفع'), { name: 'AbortError' }));
      xhr.onerror = () => fail(new Error('تعذر الاتصال'));
      const tokenAtStart = localStorage.getItem('mira_partner_token');
      const authGenAtStart = authGeneration;
      xhr.onload = () => {
        let data = {};
        try { data = JSON.parse(xhr.responseText || '{}'); } catch (error) { data = {}; }
        if (
          localStorage.getItem('mira_partner_token') !== tokenAtStart ||
          authGeneration !== authGenAtStart
        ) {
          fail(ApiError('تبديل جلسة أثناء الطلب — تُجاهل الاستجابة', { code: 'AUTH_CHANGED' }));
          return;
        }
        if (xhr.status < 200 || xhr.status >= 300) {
          const msg = data.message || data.error || `HTTP ${xhr.status}`;
          fail(ApiError(Array.isArray(msg) ? msg.join(' ') : msg, {
            status: xhr.status,
            code: data.code || null,
            fieldErrors: data.fieldErrors || null,
            body: data,
          }));
          return;
        }
        resolve(data);
      };
      xhr.send(JSON.stringify(body));
    });
  }

  window.PartnersApi = {
    base: API_BASE,
    apply: (payload) => request('POST', '/partners-portal/apply', payload),
    status: (token) =>
      request('GET', `/partners-portal/apply/status/${encodeURIComponent(token)}`),
    login: (email, password) =>
      request('POST', '/partners-portal/login', { email, password }),
    dashboard: () => request('GET', '/partners-portal/me'),
    /** Public elegance taxonomy (no partner token required). */
    taxonomy: (opts) => {
      const lane = (opts && opts.lane) || 'elegance';
      return request('GET', `/marketplace/taxonomy?lane=${encodeURIComponent(lane)}`);
    },
    /** Portal read-back path used after save (not GET /products/:id). */
    productPreview: (id) => request('GET', `/partners-portal/products/${id}/preview`),
    createProduct: (payload) =>
      request('POST', '/partners-portal/products', payload),
    updateProduct: (id, payload) =>
      request('PATCH', `/partners-portal/products/${id}`, payload),
    deleteProduct: (id) =>
      request('DELETE', `/partners-portal/products/${id}`),
    createService: (payload) =>
      request('POST', '/partners-portal/services', payload),
    updateService: (id, payload) =>
      request('PATCH', `/partners-portal/services/${id}`, payload),
    deleteService: (id) =>
      request('DELETE', `/partners-portal/services/${id}`),
    addMedia: (kind, id, mimeType, dataBase64, placement) =>
      request('POST', `/partners-portal/${kind}/${id}/media`, { mimeType, dataBase64, placement: placement || 'main' }),
    addMediaProgress: (kind, id, mimeType, dataBase64, hooks) =>
      requestProgress('POST', `/partners-portal/${kind}/${id}/media`, { mimeType, dataBase64, placement: (hooks && hooks.placement) || 'main' }, hooks),
    uploadSessionPolicy: (opts) =>
      request('GET', '/partners-portal/upload-sessions/policy', null, null, opts),
    initiateUploadSession: (payload, opts) =>
      request('POST', '/partners-portal/upload-sessions', payload, null, opts),
    getUploadSession: (sessionId, opts) =>
      request('GET', `/partners-portal/upload-sessions/${encodeURIComponent(sessionId)}`, null, null, opts),
    signUploadPart: (sessionId, partNumber, opts) =>
      request(
        'POST',
        `/partners-portal/upload-sessions/${encodeURIComponent(sessionId)}/parts/${partNumber}/sign`,
        {},
        null,
        opts,
      ),
    completeUploadSession: (sessionId, parts, opts) =>
      request(
        'POST',
        `/partners-portal/upload-sessions/${encodeURIComponent(sessionId)}/complete`,
        { parts },
        null,
        opts,
      ),
    retryFinalizeUploadSession: (sessionId, opts) =>
      request(
        'POST',
        `/partners-portal/upload-sessions/${encodeURIComponent(sessionId)}/retry-finalize`,
        {},
        null,
        opts,
      ),
    abortUploadSession: (sessionId, opts) =>
      request(
        'POST',
        `/partners-portal/upload-sessions/${encodeURIComponent(sessionId)}/abort`,
        {},
        null,
        opts,
      ),
    /**
     * Incremental SHA-256 over File slices — never loads the whole video into one ArrayBuffer.
     */
    sha256FileIncremental: async (file, hooks) => {
      const signal = hooks && hooks.signal;
      const onProgress = hooks && hooks.onProgress;
      const chunkSize = 1024 * 1024;
      // Pure JS SHA-256 (compact) — streaming updates.
      const K = new Uint32Array([
        0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
        0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
        0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
        0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
        0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
        0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
        0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
        0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
      ]);
      let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
      let total = 0;
      const w = new Uint32Array(64);
      function rotr(x,n){return (x>>>n)|(x<<(32-n));}
      function processBlock(view, offset) {
        for (let i=0;i<16;i++) w[i]=view.getUint32(offset+i*4);
        for (let i=16;i<64;i++){
          const s0=rotr(w[i-15],7)^rotr(w[i-15],18)^(w[i-15]>>>3);
          const s1=rotr(w[i-2],17)^rotr(w[i-2],19)^(w[i-2]>>>10);
          w[i]=(w[i-16]+s0+w[i-7]+s1)|0;
        }
        let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;
        for (let i=0;i<64;i++){
          const S1=rotr(e,6)^rotr(e,11)^rotr(e,25);
          const ch=(e&f)^(~e&g);
          const t1=(h+S1+ch+K[i]+w[i])|0;
          const S0=rotr(a,2)^rotr(a,13)^rotr(a,22);
          const maj=(a&b)^(a&c)^(b&c);
          const t2=(S0+maj)|0;
          h=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;
        }
        h0=(h0+a)|0;h1=(h1+b)|0;h2=(h2+c)|0;h3=(h3+d)|0;h4=(h4+e)|0;h5=(h5+f)|0;h6=(h6+g)|0;h7=(h7+h)|0;
      }
      let buffer = new Uint8Array(0);
      let offset = 0;
      while (offset < file.size) {
        if (signal && signal.aborted) throw Object.assign(new Error('أُلغي الرفع'), { name: 'AbortError' });
        const end = Math.min(file.size, offset + chunkSize);
        const slice = new Uint8Array(await file.slice(offset, end).arrayBuffer());
        total += slice.length;
        const merged = new Uint8Array(buffer.length + slice.length);
        merged.set(buffer, 0);
        merged.set(slice, buffer.length);
        let pos = 0;
        while (pos + 64 <= merged.length) {
          processBlock(new DataView(merged.buffer, merged.byteOffset + pos, 64), 0);
          pos += 64;
        }
        buffer = merged.subarray(pos);
        offset = end;
        if (typeof onProgress === 'function' && file.size) onProgress(offset / file.size);
      }
      // padding
      const bitLen = total * 8;
      const padLen = (buffer.length < 56 ? 56 : 120) - buffer.length;
      const finalBlock = new Uint8Array(buffer.length + padLen + 8);
      finalBlock.set(buffer, 0);
      finalBlock[buffer.length] = 0x80;
      const dv = new DataView(finalBlock.buffer);
      const high = Math.floor(bitLen / 0x100000000);
      const low = bitLen >>> 0;
      dv.setUint32(finalBlock.length - 8, high);
      dv.setUint32(finalBlock.length - 4, low);
      for (let i = 0; i < finalBlock.length; i += 64) {
        processBlock(new DataView(finalBlock.buffer, finalBlock.byteOffset + i, 64), 0);
      }
      const out = [h0,h1,h2,h3,h4,h5,h6,h7].map((x)=>('00000000'+(x>>>0).toString(16)).slice(-8)).join('');
      return out;
    },

    /**
     * P2.1 multipart upload: browser sends part bytes to signed URL (R2) or API (memory).
     * Progress is byte-based; completed parts are not double-counted on retry.
     */
    uploadViaSession: async (kind, id, file, hooks) => {
      const notify = hooks || {};
      const signal = notify.signal;
      const abortError = () => Object.assign(new Error('أُلغي الرفع'), { name: 'AbortError' });
      const checkAbort = () => {
        if (signal && signal.aborted) throw abortError();
      };
      const ownerKind = kind === 'products' ? 'product' : 'service';
      const mimeType = notify.mimeType || file.type || 'application/octet-stream';
      const clientMediaId = notify.clientMediaId || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
      const idempotencyKey = notify.idempotencyKey || clientMediaId;
      // Resume: if sessionId provided, refresh from server instead of creating a new session.
      let session;
      if (notify.sessionId) {
        session = await request(
          'GET',
          `/partners-portal/upload-sessions/${encodeURIComponent(notify.sessionId)}`,
          null,
          null,
          { signal },
        );
        if (session.declaredByteSize !== file.size) {
          throw ApiError('الملف المعاد اختياره لا يطابق جلسة الرفع (الحجم)', { code: 'file_mismatch' });
        }
        if (session.declaredChecksum) {
          const actual = await window.PartnersApi.sha256FileIncremental(file, { signal });
          if (actual !== session.declaredChecksum) {
            throw ApiError('الملف المعاد اختياره لا يطابق جلسة الرفع (البصمة)', { code: 'file_mismatch' });
          }
        }
      } else {
        const checksum = await window.PartnersApi.sha256FileIncremental(file, {
          signal,
          onProgress: typeof notify.onHashProgress === 'function' ? notify.onHashProgress : undefined,
        });
        checkAbort();
        session = await request('POST', '/partners-portal/upload-sessions', {
          ownerKind,
          ownerId: id,
          clientMediaId,
          idempotencyKey,
          mimeType,
          byteSize: file.size,
          checksum,
          placement: notify.placement || 'main',
          clientDraftId: notify.clientDraftId || undefined,
        }, null, { signal });
      }
      if (typeof notify.onSession === 'function') notify.onSession(session);
      const partSize = session.partSizeBytes || session.upload && session.upload.partSizeBytes || 16 * 1024 * 1024;
      const totalParts = session.totalParts || Math.ceil(file.size / partSize);
      const concurrency = (session.upload && session.upload.concurrency) || 2;
      const maxRetries = (session.upload && session.upload.partMaxRetries) || 3;
      const completedMap = new Map();
      // Authoritative parts from server (refreshed via listParts on get)
      (session.completedParts || []).forEach((p) => {
        if (p && p.partNumber) completedMap.set(p.partNumber, { partNumber: p.partNumber, etag: p.etag, size: p.size });
      });
      const reportProgress = () => {
        if (typeof notify.onProgress !== 'function') return;
        let uploaded = 0;
        completedMap.forEach((p) => { uploaded += Number(p.size) || 0; });
        notify.onProgress(file.size ? Math.min(1, uploaded / file.size) : null);
      };
      reportProgress();

      async function putPart(partNumber) {
        checkAbort();
        if (completedMap.has(partNumber)) return completedMap.get(partNumber);
        const start = (partNumber - 1) * partSize;
        const end = Math.min(file.size, start + partSize);
        const chunk = file.slice(start, end);
        let lastError = null;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          checkAbort();
          try {
            const signed = await request(
              'POST',
              `/partners-portal/upload-sessions/${encodeURIComponent(session.sessionId)}/parts/${partNumber}/sign`,
              {},
              null,
              { signal },
            );
            let putUrl = signed.url;
            if (!/^https?:\/\//i.test(putUrl)) {
              try {
                const origin = new URL(API_BASE).origin;
                putUrl = putUrl.startsWith('/') ? origin + putUrl : origin + '/' + putUrl;
              } catch (_) {
                putUrl = (API_BASE.replace(/\/$/, '') + '/' + putUrl.replace(/^\//, ''));
              }
            }
            const headers = Object.assign({}, signed.headers || {});
            // Keep Content-Type stable for CORS + signature (never rely on Blob sniffing).
            if (!headers['Content-Type'] && !headers['content-type']) {
              headers['Content-Type'] = 'application/octet-stream';
            }
            if (signed.directToApi) {
              Object.assign(headers, authHeaders());
            }
            let putRes;
            try {
              putRes = await fetch(putUrl, {
                method: signed.method || 'PUT',
                headers,
                body: chunk,
                signal: signal || undefined,
              });
            } catch (netErr) {
              const msg = (netErr && netErr.message) || String(netErr);
              throw Object.assign(
                new Error(
                  /Load failed|Failed to fetch|NetworkError|CORS/i.test(msg)
                    ? 'تعثر رفع الجزء إلى التخزين (CORS أو الشبكة) — الجزء ' + partNumber
                    : 'تعثر الاتصال أثناء رفع الجزء ' + partNumber + ': ' + msg,
                ),
                { code: 'UPLOAD_PUT_NETWORK', stage: 'put', partNumber: partNumber },
              );
            }
            if (!putRes.ok) {
              throw Object.assign(new Error('فشل رفع الجزء ' + partNumber + ' (HTTP ' + putRes.status + ')'), {
                code: 'UPLOAD_PUT_HTTP',
                stage: 'put',
                partNumber: partNumber,
                status: putRes.status,
              });
            }
            let etag = putRes.headers.get('etag') || putRes.headers.get('ETag') || '';
            if (signed.directToApi) {
              const body = await putRes.json().catch(() => ({}));
              etag = body.etag || etag;
            }
            if (!etag) {
              throw Object.assign(new Error('تعذر قراءة ETag للجزء ' + partNumber + ' بعد نجاح الرفع'), {
                code: 'UPLOAD_ETAG_MISSING',
                stage: 'etag',
                partNumber: partNumber,
              });
            }
            const row = { partNumber, etag, size: end - start };
            completedMap.set(partNumber, row);
            reportProgress();
            return row;
          } catch (error) {
            if (error && error.name === 'AbortError') throw error;
            lastError = error;
            if (attempt >= maxRetries) break;
            await new Promise((r) => setTimeout(r, Math.min(4000, 400 * Math.pow(2, attempt))));
          }
        }
        throw lastError || new Error('فشل رفع الجزء');
      }

      const pending = [];
      for (let n = 1; n <= totalParts; n++) {
        if (!completedMap.has(n)) pending.push(n);
      }
      let cursor = 0;
      async function worker() {
        while (cursor < pending.length) {
          const idx = cursor++;
          await putPart(pending[idx]);
        }
      }
      const workers = [];
      for (let i = 0; i < Math.min(concurrency, pending.length || 1); i++) workers.push(worker());
      await Promise.all(workers);
      checkAbort();
      const parts = [];
      for (let n = 1; n <= totalParts; n++) {
        const row = completedMap.get(n);
        if (!row) throw new Error('جزء مفقود بعد الرفع: ' + n);
        parts.push(row);
      }
      if (typeof notify.onProcessing === 'function') notify.onProcessing();
      let state = await request(
        'POST',
        `/partners-portal/upload-sessions/${encodeURIComponent(session.sessionId)}/complete`,
        { parts },
        null,
        { signal },
      );
      // F06: follow verifying / retryable failures until ready or permanent failure.
      // Client wait timeout ≠ server failure — surface verify_pending so UI can resume.
      const deadline = Date.now() + 180000;
      let retryFinalizeCalls = 0;
      while (state && Date.now() < deadline) {
        checkAbort();
        if (state.status === 'ready') break;
        if (state.status === 'aborted') {
          throw ApiError((state && state.failureMessageAr) || 'أُلغي الرفع', { code: 'aborted', body: state });
        }
        if (state.status === 'failed' && state.failureClass === 'permanent') {
          throw ApiError((state && state.failureMessageAr) || 'تعذر التحقق من الملف', {
            code: (state && state.failureCode) || 'upload_failed',
            body: state,
          });
        }
        if (state.status === 'failed' && state.failureClass === 'retryable' && retryFinalizeCalls < 5) {
          retryFinalizeCalls += 1;
          if (typeof notify.onProcessing === 'function') notify.onProcessing();
          state = await request(
            'POST',
            `/partners-portal/upload-sessions/${encodeURIComponent(session.sessionId)}/retry-finalize`,
            {},
            null,
            { signal },
          );
          continue;
        }
        if (
          state.status === 'uploaded' ||
          state.status === 'verifying' ||
          (state.status === 'failed' && state.failureClass === 'retryable') ||
          (state.status === 'uploading' && state.storageCompleted)
        ) {
          if (typeof notify.onProcessing === 'function') notify.onProcessing();
          await new Promise((r) => setTimeout(r, 500));
          state = await request(
            'GET',
            `/partners-portal/upload-sessions/${encodeURIComponent(session.sessionId)}`,
            null,
            null,
            { signal },
          );
          continue;
        }
        break;
      }
      if (!state || state.status !== 'ready') {
        if (
          state &&
          (state.status === 'verifying' ||
            state.status === 'uploaded' ||
            (state.status === 'failed' && state.failureClass === 'retryable') ||
            state.retryable)
        ) {
          throw ApiError('ما زال التحقق جاريًا؛ أعد المحاولة لاحقًا دون إعادة الرفع', {
            code: 'verify_pending',
            body: state,
          });
        }
        const msg = (state && state.failureMessageAr) || 'تعذر التحقق من الملف';
        throw ApiError(msg, { code: (state && state.failureCode) || 'upload_failed', body: state });
      }
      return state;
    },
    submitReview: (kind, id) =>
      request('POST', `/partners-portal/${kind}/${id}/submit-review`, {}),
    preview: (kind, id) =>
      request('GET', `/partners-portal/${kind}/${id}/preview`),
    reorderMedia: (kind, id, ids) =>
      request('PATCH', `/partners-portal/${kind}/${id}/media/order`, { ids }),
    setPrimary: (kind, id, mediaId) =>
      request('PATCH', `/partners-portal/${kind}/${id}/media/${mediaId}/primary`, {}),
    /** P2.2: bind READY media ids to a product variant (variantsJson.mediaIds). */
    bindVariantMedia: (productId, variantId, mediaIds) =>
      request('PATCH', `/partners-portal/products/${productId}/variants/${encodeURIComponent(variantId)}/media`, {
        mediaIds: Array.isArray(mediaIds) ? mediaIds : [],
      }),
    /** P3.1: variant-level inventory adapter. */
    getVariantInventory: (productId) =>
      request('GET', `/partners-portal/products/${encodeURIComponent(productId)}/variant-inventory`),
    putVariantInventory: (productId, body) =>
      request('PUT', `/partners-portal/products/${encodeURIComponent(productId)}/variant-inventory`, body || {}),
    removeMedia: (kind, id, mediaId) =>
      request('DELETE', `/partners-portal/${kind}/${id}/media/${mediaId}`),
    ads: () => request('GET', '/partners-portal/ads'),
    ad: (id) => request('GET', `/partners-portal/ads/${id}`),
    createAd: (payload) => request('POST', '/partners-portal/ads', payload),
    updateAd: (id, payload) => request('PATCH', `/partners-portal/ads/${id}`, payload),
    submitAd: (id) => request('POST', `/partners-portal/ads/${id}/submit-review`, {}),
    withdrawAd: (id) => request('POST', `/partners-portal/ads/${id}/withdraw`, {}),
    adStats: (id) => request('GET', `/partners-portal/ads/${id}/stats`),
    commerceOrders: (query) =>
      request('GET', `/partners/me/commerce/orders${query ? '?' + query : ''}`),
    commerceOrder: (id) => request('GET', `/partners/me/commerce/orders/${id}`),
    commerceOrderTransition: (id, body) =>
      request('POST', `/partners/me/commerce/orders/${id}/transition`, body),
    commerceCollectPayment: (id, body) =>
      request('POST', `/partners/me/commerce/orders/${id}/collect-payment`, body || {}),
    commerceBookings: (query) =>
      request('GET', `/partners/me/commerce/bookings${query ? '?' + query : ''}`),
    commerceBookingTransition: (id, body) =>
      request('POST', `/partners/me/commerce/bookings/${id}/transition`, body),
    track: (payload) =>
      request('POST', '/partners-portal/track', payload),
    registry: (opts) => request('GET', '/partners-portal/registry', null, null, opts),
    listEditorDrafts: (query, opts) =>
      request('GET', `/partners-portal/editor-drafts${query ? '?' + query : ''}`, null, null, opts),
    getEditorDraft: (clientDraftId, opts) =>
      request('GET', `/partners-portal/editor-drafts/${encodeURIComponent(clientDraftId)}`, null, null, opts),
    putEditorDraft: (clientDraftId, payload, opts) =>
      request('PUT', `/partners-portal/editor-drafts/${encodeURIComponent(clientDraftId)}`, payload, null, opts),
    discardEditorDraft: (clientDraftId, opts) =>
      request('DELETE', `/partners-portal/editor-drafts/${encodeURIComponent(clientDraftId)}`, null, null, opts),
    materializeEditorDraft: (clientDraftId, payload, idempotencyKey, opts) =>
      request(
        'POST',
        `/partners-portal/editor-drafts/${encodeURIComponent(clientDraftId)}/materialize`,
        payload,
        { 'Idempotency-Key': idempotencyKey },
        opts,
      ),
    listBulkBatches: (opts) => request('GET', '/partners-portal/bulk-batches', null, null, opts),
    createBulkBatch: (payload, opts) =>
      request('POST', '/partners-portal/bulk-batches', payload, null, opts),
    getBulkBatch: (batchId, opts) =>
      request('GET', `/partners-portal/bulk-batches/${encodeURIComponent(batchId)}`, null, null, opts),
    putBulkCard: (batchId, cardId, payload, opts) =>
      request(
        'PUT',
        `/partners-portal/bulk-batches/${encodeURIComponent(batchId)}/cards/${encodeURIComponent(cardId)}`,
        payload,
        null,
        opts,
      ),
    applyBulkShared: (batchId, payload, opts) =>
      request(
        'POST',
        `/partners-portal/bulk-batches/${encodeURIComponent(batchId)}/apply-shared`,
        payload,
        null,
        opts,
      ),
    materializeBulkBatch: (batchId, payload, idempotencyKey, opts) =>
      request(
        'POST',
        `/partners-portal/bulk-batches/${encodeURIComponent(batchId)}/materialize`,
        payload || {},
        { 'Idempotency-Key': idempotencyKey },
        opts,
      ),
    appendBulkCard: (batchId, opts) =>
      request('POST', `/partners-portal/bulk-batches/${encodeURIComponent(batchId)}/cards`, {}, null, opts),
    discardBulkCard: (batchId, cardId, opts) =>
      request(
        'DELETE',
        `/partners-portal/bulk-batches/${encodeURIComponent(batchId)}/cards/${encodeURIComponent(cardId)}`,
        null,
        null,
        opts,
      ),
    publishBulkGroup: (batchId, idempotencyKey, opts) =>
      request(
        'POST',
        `/partners-portal/bulk-batches/${encodeURIComponent(batchId)}/publish-group`,
        {},
        { 'Idempotency-Key': idempotencyKey || `publish-group-${batchId}` },
        opts,
      ),
    getServiceProfile: (id, opts) =>
      request('GET', `/partners-portal/services/${encodeURIComponent(id)}/service-profile`, null, null, opts),
    putServiceProfile: (id, payload, opts) =>
      request('PUT', `/partners-portal/services/${encodeURIComponent(id)}/service-profile`, payload, null, opts),
    importLocalTemplate: (id, payload, opts) =>
      request('POST', `/partners-portal/services/${encodeURIComponent(id)}/import-local-template`, payload, null, opts),
    adminList: (adminKey, status) =>
      request(
        'GET',
        `/partners-portal/admin/applications?status=${encodeURIComponent(status || 'pending')}`,
        null,
        { 'X-Admin-Key': adminKey },
      ),
    adminApprove: (adminKey, id) =>
      request('POST', `/partners-portal/admin/applications/${id}/approve`, {}, {
        'X-Admin-Key': adminKey,
      }),
    adminReject: (adminKey, id, reason) =>
      request('POST', `/partners-portal/admin/applications/${id}/reject`, { reason }, {
        'X-Admin-Key': adminKey,
      }),
    authGeneration: () => authGeneration,
    authTokenFingerprint: authTokenFingerprint,
    bumpAuthGeneration: bumpAuthGeneration,
    saveSession: (email, token) => {
      // Cancel/isolate before writing the new token so pending A work cannot ride B's session.
      bumpAuthGeneration('saveSession');
      localStorage.setItem('mira_partner_email', email);
      localStorage.setItem('mira_partner_token', token);
    },
    clearSession: () => {
      bumpAuthGeneration('clearSession');
      localStorage.removeItem('mira_partner_email');
      localStorage.removeItem('mira_partner_token');
      try { localStorage.removeItem('mira_partner_id'); } catch (e) {}
    },
    isLoggedIn: () => !!localStorage.getItem('mira_partner_token'),
  };
})();
