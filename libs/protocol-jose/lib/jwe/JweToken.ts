/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PublicKey, KeyType } from 'verifiablecredentials-crypto-sdk-typescript-keys';
import { ProtectionFormat, KeyReference } from 'verifiablecredentials-crypto-sdk-typescript-keystore';
import { Subtle, CryptoFactory, CryptoFactoryScope, CryptoHelpers, ISubtleCryptoExtension, SubtleCryptoExtension } from 'verifiablecredentials-crypto-sdk-typescript-plugin';
import { CryptoProtocolError, IPayloadProtectionOptions, ICryptoToken } from 'verifiablecredentials-crypto-sdk-typescript-protocols-common';
import { TSMap } from 'typescript-map'
import base64url from 'base64url';
import IJweGeneralJson, { JweHeader } from './IJweGeneralJson';
import { IJweEncryptionOptions } from "../IJoseOptions";
import JweRecipient from './JweRecipient';
import JoseHelpers from '../JoseHelpers';
import JoseConstants from '../JoseConstants'
import IJweRecipient from './IJweRecipient';
import IJweFlatJson from './IJweFlatJson';
import JoseProtocol from '../JoseProtocol';
import JoseToken from '../JoseToken';

/**
 * Class for containing Jwe token operations.
 * This class hides the JOSE and crypto library dependencies to allow support for additional crypto algorithms.
 * Crypto calls always happen via CryptoFactory
 */
export default class JweToken implements IJweGeneralJson {
  /**
   * The protected header.
   */
  public protected: JweHeader = new TSMap<string, string>();

  /**
   * The unprotected header.
   */
  public unprotected: JweHeader = new TSMap<string, string>();
  
  /**
   * The initial vector.
   */
  iv: Buffer = Buffer.from('');

  /**
   * The additional authenticated data.
   */
  public aad: Buffer = Buffer.from('');

  /**
   * The encrypted data.
   */
  public ciphertext: Buffer = Buffer.from('');

  /**
   * The authentication tag used by GCM.
   */
  public tag: Buffer = Buffer.from('');

  /**
   * Signatures on content
   */
  public recipients: JweRecipient[] = [];

  /**
   * Get the request serialization format
   */
  public format: ProtectionFormat = ProtectionFormat.JweGeneralJson;

  // Options passed into the constructor
  private options: IJweEncryptionOptions | undefined;

  /**
   * Create an Jwe token object
   * @param options Set of Jwe token options
   */
  constructor (options?: IJweEncryptionOptions) {
    this.options = options;
  }

//#region serialization
  /**
   * Serialize a Jwe token object from a token
   * @param format Optional specify the serialization format. If not specified, use default format.
   */
  public serialize (format?: ProtectionFormat): string {
    if (format === undefined) {
      format = this.format;
    }

      switch (format) {
        case ProtectionFormat.JweGeneralJson:
          return JweToken.serializeJweGeneralJson(this);          
        case ProtectionFormat.JweCompactJson: 
          return JweToken.serializeJweCompact(this);
        case ProtectionFormat.JweFlatJson: 
          return JweToken.serializeJweFlatJson(this);
    }
    
    throw new CryptoProtocolError(JoseConstants.Jwe, `The format '${this.format}' is not supported`);
  }

  /**
   * Serialize a Jwe token object from a token in General Json format
   * @param token Jwe base object
   */
  private static serializeJweGeneralJson (token: JweToken): string {
    let json: any = {
      recipients: [],
      aad: base64url.encode(token.aad),
      iv: base64url.encode(token.iv),
      ciphertext: base64url.encode(token.ciphertext),
      tag: base64url.encode(token.tag)      
    }
    if (JoseHelpers.headerHasElements(token.protected)) {
      json.protected = JoseHelpers.encodeHeader(<JweHeader>token.protected);
    }
    if (JoseHelpers.headerHasElements(token.unprotected)) {
      json.unprotected = JoseHelpers.encodeHeader(<JweHeader>token.unprotected, false);
    }

    for (let inx = 0 ; inx < token.recipients.length ; inx++ ) {
      const recipient: any = {
        encrypted_key: base64url.encode(token.recipients[inx].encrypted_key)
      }
      if (JoseHelpers.headerHasElements(token.recipients[inx].header)) {
        recipient.header = JoseHelpers.encodeHeader(<JweHeader>token.recipients[inx].header, false);
      }
      
      json.recipients.push(recipient);
    }

    return JSON.stringify(json);
  }

  /**
   * Serialize a Jwe token object from a token in Flat Json format
   * @param token Jwe base object
   */
  private static serializeJweFlatJson (token: JweToken): string {
    let json: any = {
      encrypted_key: base64url.encode(token.recipients[0].encrypted_key),
      aad: base64url.encode(token.aad),
      iv: base64url.encode(token.iv),
      ciphertext: base64url.encode(token.ciphertext),
      tag: base64url.encode(token.tag)      
    }
    if (JoseHelpers.headerHasElements(token.protected)) {
      json.protected = JoseHelpers.encodeHeader(<JweHeader>token.protected);
    }
    if (JoseHelpers.headerHasElements(token.unprotected)) {
      json.unprotected = JoseHelpers.encodeHeader(<JweHeader>token.unprotected);
    }
    if (JoseHelpers.headerHasElements(token.recipients[0].header)) {
      json.header = JoseHelpers.encodeHeader(<JweHeader>token.recipients[0].header, false);
    }

    return JSON.stringify(json);
  }

  /**
   * Serialize a Jwe token object from a token in Compact format
   * @param token Jwe base object
   */
  private static serializeJweCompact (token: JweToken): string {
    let encodedProtected = '';
    if (JoseHelpers.headerHasElements(token.protected)) {
      encodedProtected = JoseHelpers.encodeHeader(<JweHeader>token.protected);
    }
    const encryptedKey = base64url.encode(token.recipients[0].encrypted_key);
    const iv = base64url.encode(token.iv);
    const cipher = base64url.encode(token.ciphertext);
    const tag = base64url.encode(token.tag);
    return `${encodedProtected}.${encryptedKey}.${iv}.${cipher}.${tag}`;
  }

  //#endregion

  //#region deserialization
  /**
   * Deserialize a Jwe token object
   */
   public static deserialize (token: string, options?: IJweEncryptionOptions): JweToken {
    const jweToken = new JweToken(options);
      
    // check for JWE compact format
  if (typeof token === 'string') {
    const parts = token.split('.');
    if (parts.length === 5) {
      jweToken.protected = JweToken.setProtected(parts[0]);
      const recipient = new JweRecipient();
      recipient.encrypted_key = base64url.toBuffer(parts[1]);
      jweToken.recipients = [recipient];
      jweToken.ciphertext = base64url.toBuffer(parts[3]);
      jweToken.iv = base64url.toBuffer(parts[2]);
      jweToken.tag = base64url.toBuffer(parts[4]);
      jweToken.aad = base64url.toBuffer(parts[0]);
      return jweToken;
    }
  } else {
    throw new CryptoProtocolError(JoseConstants.Jwe, `The presented object is not deserializable.`);
  }

  // Flat or general format
  let jsonObject: any;
  try {
    jsonObject = JSON.parse(token);
  } catch (error) {
    throw new CryptoProtocolError(JoseConstants.Jwe, `The presented object is not deserializable and is no compact format.`);
  }

  // Try to handle token as IJweGeneralJSon
  let decodeStatus: { result: boolean, reason: string } = jweToken.setGeneralParts(<IJweGeneralJson>jsonObject);
     if (decodeStatus.result) {
         return jweToken;
     } else {
       console.debug(`Failed parsing as IJweGeneralJSon. Reason: ${decodeStatus.reason}`)
     }

     // Try to handle token as IJweFlatJson
     decodeStatus = jweToken.setFlatParts(<IJweFlatJson>jsonObject);
     if (decodeStatus.result) {
         return jweToken;
     } else {
       console.debug(`Failed parsing as IJweFlatJson. Reason: ${decodeStatus.reason}`);
     }
   throw new CryptoProtocolError(JoseConstants.Jwe, `The content does not represent a valid jwe token`);  
  }

  /**
   * Try to parse the input token and set the properties of this JswToken
   * @param content Alledged IJweGeneralJSon token
   * @returns true if valid token was parsed
   */
  private setGeneralParts(content: IJweGeneralJson): {result: boolean, reason: string} {
    if (content) {
      if (content.recipients) {
        this.ciphertext = base64url.toBuffer(<string><any>content.ciphertext);
        this.aad = base64url.toBuffer(<string><any>content.aad);
        this.iv = base64url.toBuffer(<string><any>content.iv);
        if (content.protected) {
          this.protected = JweToken.setProtected(content.protected);
        }
        if (content.unprotected && <any>content.unprotected !== 'e30') {
          this.unprotected = JweToken.setUnprotected(content.unprotected);
        }
        this.tag = base64url.toBuffer(<string><any>content.tag);
        this.recipients = [];
        for (let inx = 0; inx < content.recipients.length; inx ++) {
          const recipient = new JweRecipient();
          recipient.encrypted_key = base64url.toBuffer(<string><any>content.recipients[inx].encrypted_key);   
          if (content.recipients[inx].header) {
            recipient.header = JweToken.setUnprotected(<any>content.recipients[inx].header);   
          }       
          this.recipients.push(recipient);       
        }
      } else {
        // manadatory field
        return {result: false, reason: 'missing recipients'};
      }

      return this.isValidToken();
    }

    return {result: false, reason: 'no content passed'};
  }

  /**
   * Try to parse the input token and set the properties of this JswToken
   * @param content Alledged IJweFlatJson token
   * @returns true if valid token was parsed
   */
  private setFlatParts(content: IJweFlatJson): {result: boolean, reason: string} {
    if (content) {
      const recipient = new JweRecipient();

      if (content.ciphertext) {
        this.ciphertext = base64url.toBuffer(<any>content.ciphertext);
      } else {
        // manadatory field
        return {result: false, reason: 'missing ciphertext'};
      }

      if (content.encrypted_key) {
        recipient.encrypted_key = base64url.toBuffer(<any>content.encrypted_key);
      } else {
        // manadatory field
        return {result: false, reason: 'missing encrypted_key'};
      }

      if (content.iv) {
        this.iv = base64url.toBuffer(<any>content.iv);
      } else {
        // manadatory field
        return {result: false, reason: 'missing iv'};
      }

      if (content.aad) {
        this.aad = base64url.toBuffer(<any>content.aad);
      }

      if (JoseHelpers.headerHasElements(content.protected)) {
        this.protected = JweToken.setProtected(<JweHeader>content.protected);
      } 

      if (JoseHelpers.headerHasElements(content.unprotected)) {
        this.unprotected = JweToken.setUnprotected(<JweHeader>content.unprotected);
      } 

      if (JoseHelpers.headerHasElements(content.header)) {
        recipient.header = JweToken.setUnprotected(<JweHeader>content.header);
      } 

      this.recipients = [recipient];
      return this.isValidToken();
    } 

    return {result: false, reason: 'no content passed'};
  }

  /**
   * Check if a valid token was found after decoding
   */
  private isValidToken(): {result: boolean, reason: string} {
    if (!this.ciphertext) {
      return {result: false, reason: 'missing ciphertext'};
    }

    if (!this.iv) {
      return {result: false, reason: 'missing iv'};
    }

    if (!this.recipients) {
      return {result: false, reason: 'missing recipients'};
    }

    if (this.recipients.length == 0) {
      return {result: false, reason: 'recipients array is empty'};
    }

    for (let inx = 0; inx < this.recipients.length; inx++) {
      const recipient = this.recipients[inx];
      if (!recipient.encrypted_key) {
        return {result: false, reason: `recipient ${inx} is missing encrypted_key`};
      }
      if (!this.protected && !recipient.header) {
        return {result: false, reason: `recipient ${inx} is missing header and protected is also missing`};
      }
    }

    return {result: true, reason: ''};
  }
//#endregion
//#region options section
  /**
   * Get the CryptoFactory to be used
   * @param newOptions Options passed in after the constructure
   * @param manadatory True if property needs to be defined
   */
  private getCryptoFactory(newOptions?: IJweEncryptionOptions, manadatory: boolean = true): CryptoFactory {
    return JoseHelpers.getOptionsProperty<CryptoFactory>('cryptoFactory', this.options, newOptions, manadatory);
  }

  /**
   * Get the key encryption key for testing
   * @param newOptions Options passed in after the constructure
   * @param manadatory True if property needs to be defined
   */
  private getContentEncryptionKey(newOptions?: IJweEncryptionOptions, manadatory: boolean = true): Buffer {
    return JoseHelpers.getOptionsProperty<Buffer>('contentEncryptionKey', this.options, newOptions, manadatory);
  }

  /**
   * Get the initial vector for testing
   * @param newOptions Options passed in after the constructure
   * @param manadatory True if property needs to be defined
   */
  private getInitialVector(newOptions?: IJweEncryptionOptions, manadatory: boolean = true): Buffer {
    return JoseHelpers.getOptionsProperty<Buffer>('initialVector', this.options, newOptions, manadatory);
  }

  /**
   * Get the content encryption algorithm from the options
   * @param newOptions Options passed in after the constructure
   * @param manadatory True if property needs to be defined
   */
  private getContentEncryptionAlgorithm(newOptions?: IJweEncryptionOptions, manadatory: boolean = true): string {
    return JoseHelpers.getOptionsProperty<string>('contentEncryptionAlgorithm', this.options, newOptions, manadatory);
  }
//#endregion
//#region encryption functions
  /**
   * Encrypt content using the given public keys in JWK format.
   * The key type enforces the key encryption algorithm.
   * The options can override certain algorithm choices.
   * 
   * @param recipients List of recipients' public keys.
   * @param payload to encrypt.
   * @param format of the final serialization.
   * @param options used for the signature. These options override the options provided in the constructor.
   * @returns JweToken with encrypted payload.
   */
  // tslint:disable-next-line: max-func-body-length
  public async encrypt (recipients: PublicKey[], payload: string, format: ProtectionFormat, options?: IJweEncryptionOptions): Promise<JweToken> {
    const cryptoFactory: CryptoFactory = this.getCryptoFactory(options);
    const contentEncryptionAlgorithm = this.getContentEncryptionAlgorithm(options, false) || JoseConstants.AesGcm256;
    this.format = format;

    // encoded protected header
    let encodedProtected: string = '';

    // Set the resulting token
    const jweToken: JweToken = new JweToken(options || this.options);

    // Get the encryptor extensions
    const encryptor = new SubtleCryptoExtension(cryptoFactory);
    let randomGenerator = CryptoHelpers.jwaToWebCrypto(contentEncryptionAlgorithm);
    const generator: any = CryptoHelpers.getSubtleCryptoForAlgorithm(cryptoFactory, randomGenerator, CryptoFactoryScope.Public, new KeyReference('', 'secret'));

    // Set the content encryption key
    let contentEncryptionKey: Buffer = this.getContentEncryptionKey(options, false);
    if (!contentEncryptionKey) {
      const key = await generator.generateKey(randomGenerator, true, ['encrypt']);
      const jwk: any = await generator.exportKey('jwk', <CryptoKey>key);
      contentEncryptionKey = base64url.toBuffer(jwk.k);
      
    }
      // Set the initial vector
      jweToken.iv = this.getInitialVector(options, false);
      if (!jweToken.iv) {
        const key = await generator.generateKey(randomGenerator, true, ['encrypt']);
        const jwk: any = await generator.exportKey('jwk', <CryptoKey>key);
        jweToken.iv = base64url.toBuffer(jwk.k);
      }

      // Needs to be improved when alg is not provided.
      // Decide key encryption algorithm based on given JWK.
      let publicKey: PublicKey = recipients[0];
      for (let key of recipients) {
        if (key.alg === JoseConstants.RsaOaep256) {
          publicKey = key;
          break;
        }
      }
      let keyEncryptionAlgorithm: string  | undefined = publicKey.alg;
      if (!keyEncryptionAlgorithm) {
        if (publicKey.kty == KeyType.EC) {
          return Promise.reject(new Error('EC encryption not implemented'));
        } else {
          // Default RSA algorithm
          keyEncryptionAlgorithm = JoseConstants.RsaOaep256;
        }
      }
    
        // tslint:disable: no-backbone-get-set-outside-model
        jweToken.unprotected = this.getUnprotected(options) || new TSMap<string, string>();
        jweToken.protected = this.getProtected(options) || new TSMap<string, string>();
        jweToken.protected.set(JoseConstants.Alg, <string>keyEncryptionAlgorithm);
        jweToken.protected.set(JoseConstants.Enc, <string>contentEncryptionAlgorithm);
    
        if (publicKey.kid) {
          jweToken.protected.set(JoseConstants.Kid, publicKey.kid);
        }
        
        encodedProtected = JoseHelpers.headerHasElements(jweToken.protected) ?  
          JoseHelpers.encodeHeader(jweToken.protected) :
          '';

      // Set aad as the protected header
      jweToken.aad = base64url.toBuffer(encodedProtected);

    for (let inx = 0 ; inx < recipients.length; inx ++) {
      // Set the recipients structure
      const jweRecipient = new JweRecipient();
      jweToken.recipients.push(jweRecipient);

      // Decide key encryption algorithm based on given JWK.
      publicKey = recipients[inx];

      // Get key encrypter and encrypt the content key
      jweRecipient.encrypted_key = Buffer.from(
        await encryptor.encryptByJwk(
          CryptoHelpers.jwaToWebCrypto(<string>keyEncryptionAlgorithm),
          publicKey,
          contentEncryptionKey));
      const header = new TSMap<string, string>([
        [JoseConstants.Kid, <string>publicKey.kid]
      ]);
      jweRecipient.header = JweToken.setHeader(header);
    }

    // encrypt content
    const contentEncryptorKey: JsonWebKey = {
      k: base64url.encode(contentEncryptionKey),
      alg: contentEncryptionAlgorithm,
      kty: 'oct'
    };

    const encodedAad = base64url.encode(jweToken.aad);
    const cipherText = await encryptor.encryptByJwk(
      CryptoHelpers.jwaToWebCrypto(contentEncryptionAlgorithm, new Uint8Array(jweToken.iv), new Uint8Array(Buffer.from(encodedAad))),
      contentEncryptorKey,
      Buffer.from(payload));

    jweToken.tag = Buffer.from(cipherText, cipherText.byteLength - 16);
    jweToken.ciphertext = Buffer.from(cipherText, 0 , cipherText.byteLength - 16);
      
    return jweToken;
  }
  //#endregion

  //#region decryption functions
  /**
   * Decrypt the content.
   * 
   * @param decryptionKeyReference Reference to the decryption key.
   * @param options used for the signature. These options override the options provided in the constructor.
   * @returns Signed payload in compact Jwe format.
   */
// tslint:disable-next-line: max-func-body-length
   public async decrypt (decryptionKeyReference: KeyReference, options?: IJweEncryptionOptions): Promise<Buffer> {
    const cryptoFactory: CryptoFactory = this.getCryptoFactory(options);

    // Get the encryptor extensions
    const decryptor = new SubtleCryptoExtension(cryptoFactory);

    // get decryption public key
    let jwk: PublicKey = (await cryptoFactory.keyStore.get(decryptionKeyReference)).getKey<PublicKey>();

    // Get the encrypted key
    // Check if kid matches
    let contentEncryptionKey: Buffer | undefined;
    if (jwk.kid) {
    for (let inx = 0 ; inx < this.recipients.length ; inx ++) {
      const recipient = this.recipients[inx];
      if (recipient.header) {
        const headerKid = recipient.header.get(JoseConstants.Kid); 
        if (headerKid && headerKid === jwk.kid) {
          if (contentEncryptionKey = await this.decryptContentEncryptionKey(recipient, decryptor, decryptionKeyReference)) {
            break;
          }
        }
      }
    }
  }

  if (!contentEncryptionKey) {
    // try to decrypt every key
    for (let inx = 0, length = this.recipients.length ; inx < length ; inx ++) {
      const recipient = this.recipients[inx];
      if (contentEncryptionKey = await this.decryptContentEncryptionKey(recipient, decryptor, decryptionKeyReference)) {
        break;
      }
    }
  }

  if (!contentEncryptionKey) {
    return Promise.reject(new CryptoProtocolError(JoseConstants.Jwe, 'Cannot decrypt the content encryption key because of missing key'));
  }

  // Decrypt content
  const contentEncryptionAlgorithm = this.protected.get(JoseConstants.Enc);
  const iv =  new Uint8Array(this.iv); 
  const encodedAad = base64url.encode(this.aad);
  const aad = new Uint8Array(Buffer.from(encodedAad));
  const algorithm = CryptoHelpers.jwaToWebCrypto(contentEncryptionAlgorithm, iv, aad);    
  const contentJwk: JsonWebKey = {
    kty: 'oct',
    alg: contentEncryptionAlgorithm,
    k: base64url.encode(contentEncryptionKey)
  };

  const plaintext =  await decryptor.decryptByJwk(algorithm, contentJwk, Buffer.concat([this.ciphertext, this.tag]));
  return Buffer.from(plaintext);
  }

  private async decryptContentEncryptionKey(recipient: IJweRecipient, decryptor: ISubtleCryptoExtension, decryptionKeyReference: KeyReference): Promise<Buffer> {
    let keyDecryptionAlgorithm = '';
    if (!recipient.header) {
      keyDecryptionAlgorithm = this.protected.get(JoseConstants.Alg);
    } else {
      keyDecryptionAlgorithm = recipient.header.get(JoseConstants.Alg) || this.protected.get(JoseConstants.Alg);
    }

    const algorithm = CryptoHelpers.jwaToWebCrypto(keyDecryptionAlgorithm);    
    return Buffer.from(await decryptor.decryptByKeyStore(algorithm, decryptionKeyReference, recipient.encrypted_key));
   }
  //#endregion

  /**
   * Get the default protected header to be used from the options
   * @param newOptions Options passed in after the constructure
   * @param mandatory True if property needs to be defined
   */
   private getProtected(newOptions?: IJweEncryptionOptions, mandatory: boolean = false): JweHeader {
    return JoseHelpers.getOptionsProperty<JweHeader>('protected', this.options, newOptions, mandatory);
  }

  /**
   * Get the default header to be used from the options
   * @param newOptions Options passed in after the constructure
   * @param mandatory True if property needs to be defined
   */
   public getUnprotected(newOptions?: IJweEncryptionOptions, mandatory: boolean = false): JweHeader {
    return JoseHelpers.getOptionsProperty<JweHeader>('unprotected', this.options, newOptions, mandatory);
  }

  /**
   * Get the default header to be used from the options
   * @param newOptions Options passed in after the constructure
   * @param mandatory True if property needs to be defined
   */
   public getHeader(newOptions?: IJweEncryptionOptions, mandatory: boolean = false): JweHeader {
    return JoseHelpers.getOptionsProperty<JweHeader>('header', this.options, newOptions, mandatory);
  }

  /**
   * Convert a @class ICryptoToken into a @class JweToken
   * @param cryptoToken to convert
   * @param protectOptions options for the token
   */
  public static fromCryptoToken(cryptoToken: ICryptoToken, protectOptions: IPayloadProtectionOptions): JweToken {
    const options = JweToken.fromPayloadProtectionOptions(protectOptions);
    const token = new JweToken(options);
      token.protected = cryptoToken.has(JoseConstants.tokenProtected) ? cryptoToken.get(JoseConstants.tokenProtected) : undefined;
      token.unprotected = cryptoToken.has(JoseConstants.tokenUnprotected) ? cryptoToken.get(JoseConstants.tokenUnprotected) : undefined;
      token.format = <ProtectionFormat>cryptoToken.get(JoseConstants.tokenFormat);
      token.aad = cryptoToken.get(JoseConstants.tokenAad);
      token.iv = cryptoToken.get(JoseConstants.tokenIv);
      token.ciphertext = cryptoToken.get(JoseConstants.tokenCiphertext);
      token.tag = cryptoToken.get(JoseConstants.tokenTag);
      token.recipients = <JweRecipient[]>cryptoToken.get(JoseConstants.tokenRecipients);
    return token;
  }

  /**
   * Convert a @class JweToken into a @class ICryptoToken
   * @param protocolFormat format of the token
   * @param jweToken to convert
   * @param options used for the encryption. These options override the options provided in the constructor.
   */
   public static toCryptoToken(protocolFormat: ProtectionFormat, jweToken: JweToken, options: IPayloadProtectionOptions): ICryptoToken {
    const cryptoToken = new JoseToken(options);
    if (jweToken.protected) {
      cryptoToken.set(JoseConstants.tokenProtected, jweToken.protected);
    }
    if (jweToken.unprotected) {
      cryptoToken.set(JoseConstants.tokenUnprotected, jweToken.unprotected);
    }
    cryptoToken.set(JoseConstants.tokenFormat, protocolFormat);
    cryptoToken.set(JoseConstants.tokenAad, jweToken.aad);
    cryptoToken.set(JoseConstants.tokenIv, jweToken.iv);
    cryptoToken.set(JoseConstants.tokenCiphertext, jweToken.ciphertext);
    cryptoToken.set(JoseConstants.tokenTag, jweToken.tag);
    cryptoToken.set(JoseConstants.tokenRecipients, jweToken.recipients);
    return cryptoToken;
  }

  /**
   * Convert a @class IPayloadProtectionOptions into a @class IJweEncryptionOptions
   * @param protectOptions to convert
   */
  public static fromPayloadProtectionOptions(protectOptions: IPayloadProtectionOptions): IJweEncryptionOptions {
    return <any>{
      cryptoFactory: protectOptions.cryptoFactory,
      protected: protectOptions.options.has(JoseConstants.optionProtectedHeader) ? <JweHeader>protectOptions.options.get(JoseConstants.optionProtectedHeader) : undefined, 
      header: protectOptions.options.has(JoseConstants.optionHeader) ? <JweHeader>protectOptions.options.get(JoseConstants.optionHeader) : undefined,
      kidPrefix:  protectOptions.options.has(JoseConstants.optionKidPrefix) ? <JweHeader>protectOptions.options.get(JoseConstants.optionKidPrefix) : undefined,
      contentEncryptionAlgorithm:  protectOptions.options.get(JoseConstants.optionContentEncryptionAlgorithm)
    };
  }

  /**
   * Convert a @class IPayloadProtectionOptions into a @class IJweEncryptionOptions
   * @param encryptionOptions to convert
   */
   public static toPayloadProtectionOptions(encryptionOptions: IJweEncryptionOptions): IPayloadProtectionOptions {
    const protectOptions = <any>{
      cryptoFactory: encryptionOptions.cryptoFactory,
      payloadProtection: new JoseProtocol(),
      options: new TSMap<string, any>(),
      contentEncryptionAlgorithm: encryptionOptions.contentEncryptionAlgorithm 
    };
    if (encryptionOptions.header) {
      protectOptions.options.set(JoseConstants.optionHeader, encryptionOptions.header);
    }
    if (encryptionOptions.protected) {
      protectOptions.options.set(JoseConstants.optionProtectedHeader, encryptionOptions.protected);
    }
    if (encryptionOptions.kidPrefix) {
      protectOptions.options.set(JoseConstants.optionKidPrefix, encryptionOptions.kidPrefix);
    }
    
    return protectOptions;
  }
  
  /**
   * Set the header in the recipients object
   * @param header to set on the JweToken recipients object
   */
  private static setHeader(header: string | JweHeader) {
    if (typeof header === 'string') {
      return new TSMap<string, string>().fromJSON(JSON.parse(header));
    }

    return header;
  }

  /**
   * Set the unprotected header
   * @param unprotectedHeader to set on the JweToken object
   */
   private static setUnprotected(unprotectedHeader: string | JweHeader) {
    if (typeof unprotectedHeader === 'string') {
      return new TSMap<string, string>().fromJSON(JSON.parse(unprotectedHeader));
    }

    return unprotectedHeader;
  }
  
  /**
   * Set the protected header
   * @param protectedHeader to set on the JweToken object
   */
   private static setProtected(protectedHeader: string | JweHeader) {
    if (typeof protectedHeader === 'string') {
      const json = base64url.decode(protectedHeader);
      return new TSMap<string, string>().fromJSON(JSON.parse(json));
    }

    return protectedHeader;
  }

}
