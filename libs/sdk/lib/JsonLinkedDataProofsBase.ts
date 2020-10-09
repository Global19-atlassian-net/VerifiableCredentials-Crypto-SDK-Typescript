/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IJsonLinkedDataProofSuite } from './index';
import { IPayloadProtectionSigning } from 'verifiablecredentials-crypto-sdk-typescript-protocols-common';
import { PublicKey } from 'verifiablecredentials-crypto-sdk-typescript-keys';

export default class JsonLinkedDataProofsBase implements IJsonLinkedDataProofSuite {

  /**
   * Create instance of <see @class Jose>
   * @param builder The builder object
   */
  constructor(
    protected _signer: IPayloadProtectionSigning) {
  }

  protected _credential: any | undefined;

  /**
   * Gets the type of the suite
   */
  public get type(): string[] {
    return ['']
  }

  /**
   * Gets the algorithm for the suite
   */
  public get alg(): string{
    return '';
  }

  /**
   * Embed the signature into the payload
   * @param payload to embed signature
   */
  public async sign(_payload: object): Promise<any> {
    return new Promise((_, reject) => {
      reject('sign not implemented')
    });
  }

  /**
   * Verify the signature.
   *
   * @param validationKeys Public key to validate the signature.
   * @returns True if signature validated.
   */
  public async verify(_validationKeys?: PublicKey[]): Promise<boolean> {
    return new Promise((_, reject) => {
      reject('verify not implemented')
    });
  }

  /**
  * Serialize a cryptographic token
  * @param signedPayload The payload to serialize
  */
  public serialize(signedPayload?: any): Promise<string> {
    return new Promise((resolve, reject) => {
      this._credential = signedPayload ? signedPayload : this._credential;
      if (!this._credential) {
        reject('No credential to serialize');
      }

      resolve(JSON.stringify(this._credential));
    });
  }

  /**
   * Deserialize a credential
   * @param credential The credential to deserialize.
   */
  public deserialize(credential: string): Promise<any> {
    return new Promise((resolve) => {
      this._credential = JSON.parse(credential);
      resolve(this._credential);
    });
  }
}