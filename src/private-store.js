'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');

function privateStore(directory, safeStorage) {
  const available=()=>safeStorage.isEncryptionAvailable() && (!safeStorage.getSelectedStorageBackend || safeStorage.getSelectedStorageBackend()!=='basic_text');
  const encode=text=>{
    if(!available())throw new Error('OS-protected encryption is unavailable. Persistent organization storage is locked.');
    return JSON.stringify({format:'aicc-encrypted-v1',ciphertext:safeStorage.encryptString(text).toString('base64')});
  };
  const decode=text=>{
    if(!available())throw new Error('OS-protected encryption is unavailable.');
    const envelope=JSON.parse(text);
    if(envelope.format!=='aicc-encrypted-v1'||typeof envelope.ciphertext!=='string')throw new Error('Unrecognized encrypted storage format.');
    return safeStorage.decryptString(Buffer.from(envelope.ciphertext,'base64'));
  };
  const file=path.join(directory,'organization.enc.json');
  let queue=Promise.resolve();
  return {
    available, encode, decode,
    flush:()=>queue.catch(()=>{}),
    async exists(){try{await fs.access(file);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}},
    async read(){try{return decode(await fs.readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}},
    save(text){const operation=queue.catch(()=>{}).then(async()=>{
      if(typeof text!=='string'||Buffer.byteLength(text)>20*1024*1024)throw new Error('Organization data must be under 20 MB.');
      const encrypted=encode(text);if(decode(encrypted)!==text)throw new Error('Encryption verification failed.');
      await fs.mkdir(directory,{recursive:true});await fs.writeFile(`${file}.tmp`,encrypted,{mode:0o600});await fs.rename(`${file}.tmp`,file);
    });queue=operation;return operation;},
  };
}
module.exports={privateStore};
