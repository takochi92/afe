// MAIN world（ページと同じ世界）で document_start に動く。navigator.credentials.create/get（publicKey のみ）を包む。
// ここには秘密情報を一切置かない。判断・署名は拡張本体が行い、ここは結果の組み立てだけ。
(() => {
  'use strict';
  if (window.top !== window || !navigator.credentials || !window.PublicKeyCredential) return;
  const C = navigator.credentials, origCreate = C.create.bind(C), origGet = C.get.bind(C);
  const toU8 = b => b instanceof ArrayBuffer ? new Uint8Array(b) : new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  const ue = b => { let s = ''; for (const c of toU8(b)) s += String.fromCharCode(c); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const ud = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); s += '==='.slice((s.length + 3) % 4); return Uint8Array.from(atob(s), c => c.charCodeAt(0)).buffer; };
  const pend = new Map();
  window.addEventListener('message', e => {
    const d = e.data; if (e.source !== window || !d || d.__afeVault !== 'res') return;
    const f = pend.get(d.id); if (f) { pend.delete(d.id); f(d); }
  });
  const ask = msg => new Promise(r => { const id = crypto.randomUUID(); pend.set(id, r); window.postMessage({ __afeVault: 'req', id, ...msg }, location.origin); });
  const mk = (proto, props) => { const o = Object.create(proto || Object.prototype);
    for (const [k, v] of Object.entries(props)) Object.defineProperty(o, k, { value: v, enumerable: true }); return o; };
  const fail = r => { throw new DOMException(r.message || 'The operation either timed out or was not allowed.', r.name || 'NotAllowedError'); };

  function buildCreate(c) {
    const json = { id: c.id, rawId: c.id, type: 'public-key', authenticatorAttachment: 'platform', clientExtensionResults: { credProps: { rk: true } },
      response: { clientDataJSON: c.clientDataJSON, attestationObject: c.attestationObject, authenticatorData: c.authData, publicKey: c.publicKey, publicKeyAlgorithm: -7, transports: ['internal', 'hybrid'] } };
    const response = mk(window.AuthenticatorAttestationResponse && AuthenticatorAttestationResponse.prototype, {
      clientDataJSON: ud(c.clientDataJSON), attestationObject: ud(c.attestationObject),
      getAuthenticatorData: () => ud(c.authData), getPublicKey: () => ud(c.publicKey), getPublicKeyAlgorithm: () => -7, getTransports: () => ['internal', 'hybrid'] });
    return mk(PublicKeyCredential.prototype, { id: c.id, rawId: ud(c.id), type: 'public-key', authenticatorAttachment: 'platform', response,
      getClientExtensionResults: () => ({ credProps: { rk: true } }), toJSON: () => json });
  }
  function buildGet(c) {
    const json = { id: c.id, rawId: c.id, type: 'public-key', authenticatorAttachment: 'platform', clientExtensionResults: {},
      response: { clientDataJSON: c.clientDataJSON, authenticatorData: c.authData, signature: c.signature, userHandle: c.userHandle } };
    const response = mk(window.AuthenticatorAssertionResponse && AuthenticatorAssertionResponse.prototype, {
      clientDataJSON: ud(c.clientDataJSON), authenticatorData: ud(c.authData), signature: ud(c.signature), userHandle: c.userHandle ? ud(c.userHandle) : null });
    return mk(PublicKeyCredential.prototype, { id: c.id, rawId: ud(c.id), type: 'public-key', authenticatorAttachment: 'platform', response,
      getClientExtensionResults: () => ({}), toJSON: () => json });
  }

  C.create = function (opts) {
    const pk = opts && opts.publicKey;
    if (!pk || (opts.signal && opts.signal.aborted)) return origCreate(opts);
    let msg;
    try {
      msg = { kind: 'create', rpId: pk.rp && pk.rp.id || null, rpName: pk.rp && pk.rp.name || '', challenge: ue(pk.challenge),
        userId: ue(pk.user.id), userName: pk.user.name || '', userDisplayName: pk.user.displayName || '',
        algs: (pk.pubKeyCredParams || []).map(p => p.alg), exclude: (pk.excludeCredentials || []).map(c => ue(c.id)) };
    } catch { return origCreate(opts); }
    return ask(msg).then(r => r.action === 'native' ? origCreate(opts) : r.action === 'ok' ? buildCreate(r.cred) : fail(r));
  };
  C.get = function (opts) {
    const pk = opts && opts.publicKey;
    // 条件付き（オートフィル欄の）要求は対象外：標準の動作へ
    if (!pk || opts.mediation === 'conditional' || (opts.signal && opts.signal.aborted)) return origGet(opts);
    let msg;
    try { msg = { kind: 'get', rpId: pk.rpId || null, challenge: ue(pk.challenge), allow: (pk.allowCredentials || []).map(c => ue(c.id)) }; }
    catch { return origGet(opts); }
    return ask(msg).then(r => r.action === 'native' ? origGet(opts) : r.action === 'ok' ? buildGet(r.cred) : fail(r));
  };
})();
