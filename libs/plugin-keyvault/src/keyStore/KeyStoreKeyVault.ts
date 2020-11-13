/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TokenCredential } from '@azure/identity';
import { KeyClient, JsonWebKey, CryptographyClient } from '@azure/keyvault-keys';
import { SecretClient } from '@azure/keyvault-secrets';
import { KeyStoreOptions, IKeyStore, KeyStoreListItem, KeyReference } from 'verifiablecredentials-crypto-sdk-typescript-keystore';
import { OkpPrivateKey, OkpPublicKey, RsaPublicKey, EcPublicKey, KeyType, OctKey, KeyContainer, CryptographicKey, EcPrivateKey, RsaPrivateKey } from 'verifiablecredentials-crypto-sdk-typescript-keys';
import base64url from 'base64url';
const clone = require('clone');
  
/**
 * Key store class for accessing key vault
 */
export default class KeyStoreKeyVault implements IKeyStore {

  public static SECRETS = 'secret'
  public static KEYS = 'key';

  private keyClient: KeyClient;
  private secretClient: SecretClient;


  /**
   * Create a new instance of @class KeyStoreKeyVault
   * @param credential TokenCredential intance.
   * @param vaultUri of the key vault endpoint
   * @param cache IKeyStore used as cache
   */
  constructor(
    private readonly credential: TokenCredential,
    private vaultUri: string,
    public cache: IKeyStore
  ) {
    this.keyClient = new KeyClient(vaultUri, this.credential);
    this.secretClient = new SecretClient(vaultUri, this.credential);
    if (!this.vaultUri.endsWith('/')) {
      this.vaultUri += '/';
    }
  }

  private chacheId(keyReference: KeyReference): string {
    const reference = keyReference.remoteKeyReference || keyReference.keyReference;
    const id = `${keyReference.type}-${reference}-${this.vaultUri}`;
    return id;
  }

  /**
   * Returns the key container associated with the specified
   * key reference.
   * @param keyIdentifier for which to return the key.
     * @param [options] Options for retrieving.
   */
  public async get(keyReference: KeyReference, options: KeyStoreOptions = new KeyStoreOptions({ extractable: false })): Promise<KeyContainer> {
    try {
      const client = this.getKeyStoreClient(keyReference.type);
      const keyName = keyReference.remoteKeyReference || keyReference.keyReference;

      const versionList: any[] = [];
      if (keyReference.type === KeyStoreKeyVault.SECRETS) {
        // Get extractable secrets 
        // Check the cache first
        try {
          //const cached = await this.cache.get(keyReference, options);
          //return cached;
        } catch {
          // the key was not in the cache
          console.log(`${keyName} not found in cache`)
        }
  
        const secretClient: SecretClient = <SecretClient>client;
        if (options.latestVersion || keyName.includes('/')) {
          const secret = await secretClient.getSecret(keyName);
          (<any>secret).keyType = 'Oct';
          try {
            secret.value = JSON.parse(<string>secret.value);
            (<any>secret).keyType = (<any>secret.value).kty;
          } catch (e) {
            // no key container in secret
            console.log(`parsing of latest version of key from keyvault failed: ${keyName}`);
          }
  
          versionList.push(secret);
        } else {
          for await (const keyProperties of secretClient.listPropertiesOfSecretVersions(keyName)) {
            let secret = await secretClient.getSecret(keyName, { version: keyProperties.version! });
            (<any>secret).keyType = 'Oct';
            try {
              secret.value = JSON.parse(<string>secret.value);
              (<any>secret).keyType = (<any>secret.value).kty;
            } catch {
              // no key container in secret
              console.log(`parsing of versions of key from keyvault failed: ${keyName}`);
            }
  
            versionList.push(secret);
          }
        }
      } else {
        // Get non extractable keys returning public keys
        const keyClient: KeyClient = <KeyClient>client;
        if (options.latestVersion || keyName.includes('/')) {
          const key = await keyClient.getKey(keyName);
          versionList.push(key);
        } else {
          for await (const keyProperties of keyClient.listPropertiesOfKeyVersions(keyName)) {
            const key = await keyClient.getKey(keyName, { version: keyProperties.version! });
            versionList.push(key);
          }
        }
      }
  
      let container: KeyContainer | undefined = undefined;
      let keyContainerItem: CryptographicKey | undefined;
      for (let inx = versionList.length - 1; inx >= 0; inx--) {
        const version = versionList[inx];
        const kty = (<string>version.keyType).toLocaleUpperCase();
        if (kty === 'OCT') {
          const value = version.value;
          keyContainerItem = new OctKey(value)
          if (container) {
            container.add(keyContainerItem);
          } else {
            container = new KeyContainer(keyContainerItem);
          }
        } else {
          if (keyReference.type === KeyStoreKeyVault.SECRETS) {
            if (kty === 'EC') {
              keyContainerItem = options.publicKeyOnly ?
                new EcPublicKey(version.key ? version.key : version.value as any) : new EcPrivateKey(version.key ? version.key : version.value as any);
            } else if (kty === 'OKP') {
              keyContainerItem = options.publicKeyOnly ?
              new OkpPublicKey(version.key ? version.key : version.value as any) : new OkpPrivateKey(version.key ? version.key : version.value as any);
            } else if (kty === 'RSA'){
              keyContainerItem = options.publicKeyOnly ?
                new RsaPublicKey(version.key ? version.key : version.value as any) : new RsaPrivateKey(version.key ? version.key : version.value as any);
            } else {
              throw new Error(`Non supported key type ${kty}`);
            }
          } else {
            if (kty === 'EC') {
              keyContainerItem = new EcPublicKey(version.key ? version.key : version.value as any);
            } else {
              keyContainerItem = new RsaPublicKey(version.key ? version.key : version.value as any);
            }
          }
  
          if (container) {
            container.add(keyContainerItem);
          } else {
            container = new KeyContainer(keyContainerItem);
          }
        }
  
        // cache the private key
        if (keyContainerItem && keyReference.type === KeyStoreKeyVault.SECRETS) {
          await this.cache.save(keyReference, keyContainerItem);
        }
      }
  
      if (!container) {
        throw new Error(`The secret with reference '${keyName}' has not usable secrets`);
      }
  
      return container;
      } catch (e) {
        console.error(`Could not retrieve ${JSON.stringify(keyReference)}. Error: ${e}`);
        throw e;
    }

  }

  /**
   * Saves the specified secret to the key store using
   * the key reference.
   * @param keyReference Reference for the key being saved.
   * @param key being saved to the key store.
   * @param [options] Options for saving.
   */
  async save(keyReference: KeyReference, key: CryptographicKey | string, _options: KeyStoreOptions = new KeyStoreOptions()): Promise<void> {
    if (!keyReference || !keyReference.keyReference) {
      throw new Error(`Key reference needs to be specified`);
    }
    const keyName = keyReference.remoteKeyReference || keyReference.keyReference;

    // add kid
    const kid = `${this.vaultUri}${keyReference.type}s/${keyName}`;

    const client = this.getKeyStoreClient(keyReference.type);
    if (keyReference.type === KeyStoreKeyVault.SECRETS) {
      const secretClient: SecretClient = <SecretClient>client;
      if (typeof key === 'object') {
        (<any>key).kid = kid;
        const serialKey = JSON.stringify(key);
        const value = await secretClient.setSecret(keyName, serialKey);
        //(<any>key).kid = value.properties.id;
      } else {
        key = new OctKey(base64url.encode(<string>key));
        (<any>key).kid = kid;
        const serialKey = JSON.stringify(key);
        const value = await secretClient.setSecret(keyName, serialKey);
      }

    } else {
      (<any>key).kid = kid;
      const keyClient: KeyClient = <KeyClient>client;
      const kvKey = KeyStoreKeyVault.toKeyVaultKey(<any>key);
      const cryptoKey = await keyClient.importKey(keyName, <any>kvKey);

      // Save public key in cach
      await this.cache.save(keyReference, key);
    }
  }

  /**
   * Lists all key references with their corresponding key ids
   */
  async list(type: string = KeyStoreKeyVault.SECRETS, options: KeyStoreOptions = new KeyStoreOptions()): Promise<{ [name: string]: KeyStoreListItem }> {
    const client = this.getKeyStoreClient(type);
    const list: { [name: string]: KeyStoreListItem } = {};
    if (type === KeyStoreKeyVault.SECRETS) {
      const secretClient: SecretClient = <SecretClient>client;
      for await (const secretProperties of secretClient.listPropertiesOfSecrets()) {
        list[secretProperties.name] = <KeyStoreListItem>{
          kids: [secretProperties.id],
          kty: KeyType.Oct
        };

        if (!options.latestVersion) {
          list[secretProperties.name].kids = [];
          for await (const versionProperties of secretClient.listPropertiesOfSecretVersions(secretProperties.name)) {
            list[secretProperties.name].kids.push(<string>versionProperties.id);
          }
        }
      }
    } else {
      const keyClient: KeyClient = <KeyClient>client;
      for await (const keyProperties of keyClient.listPropertiesOfKeys()) {
        const key = await keyClient.getKey(keyProperties.name);
        list[keyProperties.name] = <KeyStoreListItem>{
          kids: [(<any>keyProperties).kid],
          kty: key.keyType
        };

        if (!options.latestVersion) {
          list[keyProperties.name].kids = [];
          for await (const versionProperties of keyClient.listPropertiesOfKeyVersions(keyProperties.name)) {
            list[keyProperties.name].kids.push(<string>(<any>versionProperties).kid);
          }
        }
      }
    }
    return list;
  }

  /**
   * Convert key container into a key vault compatible key
   * @param container to convert
   */
  public static toKeyVaultKey(jwk: JsonWebKey): JsonWebKey {
    const key = clone(jwk);

    if (key.kty === KeyType.EC || (<any>key).kty === 'EC') {
      key.kty = 'EC';
      key.x = base64url.toBuffer((<any>key).x);
      key.y = base64url.toBuffer((<any>key).y);
      if (key.d) {
        key.d = base64url.toBuffer((<any>key).d);
      }
    } else if (key.kty === KeyType.RSA || (<any>key).kty === 'RSA') {
      key.kty = 'RSA'
      key.e = base64url.toBuffer((<any>key).e);
      key.n = base64url.toBuffer((<any>key).n);
      if (key.d) {
        key.d = base64url.toBuffer((<any>key).d);
        key.p = base64url.toBuffer((<any>key).p);
        key.q = base64url.toBuffer((<any>key).q);
        key.dp = base64url.toBuffer((<any>key).dp);
        key.dq = base64url.toBuffer((<any>key).dq);
        key.qi = base64url.toBuffer((<any>key).qi);
      }
    }

    return key;
  }

  /**
   * Get the client to access the key vault store
   */
  public getKeyStoreClient(type: string): KeyClient | SecretClient {
    const extractable = type === KeyStoreKeyVault.SECRETS;
    if (extractable) {
      return this.secretClient;
    } else {
      return this.keyClient;
    }
  }

  /**
   * Get the client for crypto operations by the specified key
   * @param kid referencing the key for the crypto operations
   */
  public getCryptoClient(kid: string) {
    return new CryptographyClient(kid, this.credential);
  }
}
