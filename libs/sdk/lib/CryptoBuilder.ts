/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CryptoFactory, Crypto, Subtle, IKeyStore, KeyStoreFactory, CryptoFactoryManager, SubtleCryptoNode, KeyStoreInMemory, TokenCredential, KeyStoreOptions } from './index';
import { KeyReference } from 'verifiablecredentials-crypto-sdk-typescript-keystore';
import { CryptoFactoryNode } from 'verifiablecredentials-crypto-sdk-typescript-plugin-cryptofactory-suites';

export default class CryptoBuilder {
  // Set the default crypto state
  private _keyStore: IKeyStore = new KeyStoreInMemory();
  private _subtle: Subtle = new SubtleCryptoNode().getSubtleCrypto();
  private _cryptoFactory: CryptoFactory = new CryptoFactoryNode(this.keyStore, this.subtle);

  private _recoveryKeyOptions: KeyStoreOptions = {
    publicKeyOnly: false,  // get private key, key vault only returns public key
    latestVersion: true    // take last version of the key
  };
  private _updateKeyOptions: KeyStoreOptions = {
    publicKeyOnly: false,  // get private key, key vault only returns public key
    latestVersion: true    // take last version of the key
  };
  private _signingKeyOptions: KeyStoreOptions = {
    publicKeyOnly: false,  // get private key, key vault only returns public key
    latestVersion: true    // take last version of the key
  };
  
  private _signingAlgorithm: string = 'ES256K';
  private _recoveryAlgorithm: string = 'ES256K';
  private _updateAlgorithm: string = 'ES256K';
  private _did: string | undefined;

  // key references
  private _recoveryKeyName: string | undefined;
  private _recoveryKeyReference: KeyReference | undefined;
  private _updateKeyName: string | undefined;
  private _updateKeyReference: KeyReference | undefined;
  private _signingKeyName: string | undefined;
  private _signingKeyReference: KeyReference | undefined;

  /**
   * Create a crypto builder to provide crypto capabilities
   */
  constructor() {
  }

  /**
   * True is the signing key can be extracted from the key store
   */
  public get signingKeyIsExtractable(): boolean {
    if (this._signingKeyReference) {
      return this._signingKeyReference.type === 'secret';
    } else {
      return true;
    }
  }

  /**
   * True is the recovery key can be extracted from the key store
   */
  public get recoveryKeyIsExtractable(): boolean {
    if (this._recoveryKeyReference) {
      return this._recoveryKeyReference.type === 'secret';
    } else {
      return true;
    }
  }

  /**
   * True is the update key can be extracted from the key store
   */
  public get updateKeyIsExtractable(): boolean {
    if (this._updateKeyReference) {
      return this._updateKeyReference.type === 'secret';
    } else {
      return true;
    }
  }

  /**
   * Get the DID of the requestor
   */
  public get did() {
    return this._did;
  }

  /**
   * Set the DID of the app
   */
  public useDid(did: string): CryptoBuilder {
    this._did = did;
    return this;
  }

  /**
   * Get the reference in the key store to the recovery key
   */
  public get recoveryKeyReference(): KeyReference {    
    if (this._recoveryKeyReference) {
      return this._recoveryKeyReference;
    }

    return new KeyReference(`recovery-${this._recoveryAlgorithm}`, 'secret');
  }

  /**
   * Get the options for retrieving and storing recovery keys in the key store
   */
  public get recoveryKeyOptions(): KeyStoreOptions {
    return this._recoveryKeyOptions;
  }
  /**
   * Set the reference in the key store to the recovery key
   */
  public useRecoveryKeyReference(
    recoveryKeyReference: KeyReference,
    options: KeyStoreOptions = {
      publicKeyOnly: false,  // get private key, key vault only returns public key
      latestVersion: true    // take last version of the key
    }): CryptoBuilder {
    this._recoveryKeyReference = recoveryKeyReference;
    this._recoveryKeyOptions = options;
    return this;
  }

  /**
   * Get the update in the key store to the update key
   */
  public get updateKeyReference(): KeyReference {    
    if (this._updateKeyReference) {
      return this._updateKeyReference;
    }

    return new KeyReference(`update-${this._updateAlgorithm}`, 'secret');
  }

  /**
   * Set the update in the key store to the recovery key
   */
  public useUpdateKeyReference(
    updateKeyReference: KeyReference,
    options: KeyStoreOptions = {
      publicKeyOnly: false,  // get private key, key vault only returns public key
      latestVersion: true    // take last version of the key
    }): CryptoBuilder {
    this._updateKeyReference = updateKeyReference;
    this._updateKeyOptions = options;
    return this;
  }

  /**
   * Get the options for retrieving and storing update keys in the key store
   */
  public get updateKeyOptions(): KeyStoreOptions {
    return this._updateKeyOptions;
  }

  /**
   * Get the reference in the key store to the signing key
   */
  public get signingKeyReference(): KeyReference {
    if (this._signingKeyReference) {
      return this._signingKeyReference;
    }

    return new KeyReference(`signing-${this._signingAlgorithm}`, 'secret');
  }

  /**
   * Set the reference in the key store to the signing key
   */
  public useSigningKeyReference(
    signingKeyReference: KeyReference,
    options: KeyStoreOptions = {
      publicKeyOnly: false,  // get private key, key vault only returns public key
      latestVersion: true    // take last version of the key
    }): CryptoBuilder {
    this._signingKeyReference = signingKeyReference;
    this._signingKeyOptions = options;
    return this;
  }

  /**
   * Get the options for retrieving and storing signing keys in the key store
   */
  public get signingKeyOptions(): KeyStoreOptions {
    return this._signingKeyOptions;
  }

  /**
   * Get the algorithm/suite used for signing
   */
  public get signingAlgorithm(): string {
    return this._signingAlgorithm;
  }

  /**
   * Get the algorithm/suite used for recovery
   */
  public get recoveryAlgorithm(): string {
    return this._recoveryAlgorithm;
  }

  /**
   * Get the algorithm/suite used for update
   */
  public get updateAlgorithm(): string {
    return this._updateAlgorithm;
  }

  /**
   * Set the algorithm/suite used for signing
   */
  public useSigningAlgorithm(signingAlgorithm: string): CryptoBuilder {
    this._signingAlgorithm = signingAlgorithm;
    return this;
  }

  /**
   * Set the algorithm/suite used for recovery
   */
  public useRecoveryAlgorithm(recoveryAlgorithm: string): CryptoBuilder {
    this._recoveryAlgorithm = recoveryAlgorithm;
    return this;
  }

  /**
   * Set the algorithm/suite used for update
   */
  public useUpdateAlgorithm(updateAlgorithm: string): CryptoBuilder {
    this._updateAlgorithm = updateAlgorithm;
    return this;
  }

  /**
   * Gets the key store
   */
  public get keyStore(): IKeyStore {
    return this._keyStore;
  }

  /**
   * Gets the crypto factory
   */
  public get cryptoFactory(): CryptoFactory {
    return this._cryptoFactory;
  }

  /**
   * Sets the crypto factory
   */
  public useCryptoFactory(value: CryptoFactory): CryptoBuilder {
    this._cryptoFactory = value;
    this._keyStore = value.keyStore;
    return this;
  }

  /**
   * Gets the W3C subtle crypto web API
   */
  public get subtle(): Subtle {
    return this._subtle;
  }

  /**
   * Build the crypto object
   */
  public build(): Crypto {
    return new Crypto(this);
  }

  /**
   * Use Key Vault as keystore and crypto factory
   * @param tenantGuid Guid for the tenant
   * @param clientId Client id to access Key Vault
   * @param clientSecret Client secret to access Key Vault
   * @param vaultUri Vault uri
   */
  public useKeyVault(
    credential: TokenCredential,
    vaultUri: string
  ): CryptoBuilder {


    this._keyStore = KeyStoreFactory.create('KeyStoreKeyVault', credential, vaultUri);
    this._subtle = new SubtleCryptoNode().getSubtleCrypto();
    this._cryptoFactory = CryptoFactoryManager.create(
      'CryptoFactoryKeyVault',
      this.keyStore!,
      this.subtle!);

    return this;
  }
}