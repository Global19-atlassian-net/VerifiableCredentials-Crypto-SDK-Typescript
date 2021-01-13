/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { JwsToken, JoseConstants, IJwsSigningOptions, JoseProtocol } from '../lib/index'
import { CryptoProtocolError, IPayloadProtectionOptions } from 'verifiablecredentials-crypto-sdk-typescript-protocols-common';
import { KeyStoreInMemory, ProtectionFormat, KeyReference, KeyStoreOptions, CryptoError } from 'verifiablecredentials-crypto-sdk-typescript-keystore';
import { CryptoFactory, SubtleCryptoNode, SubtleCryptoExtension } from 'verifiablecredentials-crypto-sdk-typescript-plugin';
import { OctKey, PublicKey, KeyContainer } from 'verifiablecredentials-crypto-sdk-typescript-keys';
import { TSMap } from "typescript-map";
const clone = require('clone');

describe('JwsToken', () => {
  it('should create a jws token', async () => {
    const payload = 'test payload';
    const keyStore = new KeyStoreInMemory();
    const seedReference = 'seed';
    await keyStore.save(new KeyReference(seedReference), new OctKey('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'));
    const subtle = SubtleCryptoNode.getSubtleCrypto();
    const options: IJwsSigningOptions = {
      algorithm: <Algorithm>{ name: 'ECDSA', namedCurve: 'secp256k1', hash: { name: 'SHA-256' } },
      cryptoFactory: new CryptoFactory(keyStore, subtle)
    };
    const generate = new SubtleCryptoExtension(options.cryptoFactory);

    const privateKey = await generate.generatePairwiseKey(options.algorithm, seedReference, 'did:personaId', 'did:peerId');
    (<any>privateKey).alg = 'ES256K';
    (<any>privateKey).defaultSignAlgorithm = 'ES256K';

    await keyStore.save(new KeyReference('key'), privateKey);
    const jwsToken = new JwsToken(options);
    const signature = await jwsToken.sign(new KeyReference('key'), Buffer.from(payload), ProtectionFormat.JwsGeneralJson);
    expect(signature).toBeDefined();

    expect(jwsToken.serialize()).toBeDefined();
    expect(jwsToken.serialize(ProtectionFormat.JwsGeneralJson)).toBeDefined();
    expect(jwsToken.serialize(ProtectionFormat.JwsFlatJson)).toBeDefined();
    expect(jwsToken.serialize(ProtectionFormat.JwsCompactJson)).toBeDefined();
    
    // negative cases
    expect(() => jwsToken.serialize(<any>'aaa')).toThrow(new CryptoProtocolError(JoseConstants.Jws,`The format 'JwsGeneralJson' is not supported`));
/*
    let clonedJwsToken: JwsToken = clone(jwsToken);
    clonedJwsToken.signatures[0] = <any>undefined;
    expect(() => jwsToken.serialize()).toThrowError(`The format 'JwsGeneralJson' is not supported`);
*/
  });
  it('should create a jws token in compact', async () => {
    const payload = 'test payload';
    const keyStore = new KeyStoreInMemory();
    const seedReference = 'seed';
    await keyStore.save(new KeyReference(seedReference), new OctKey('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'));
    const subtle = SubtleCryptoNode.getSubtleCrypto();
    const options: IJwsSigningOptions = {
      algorithm: <Algorithm>{ name: 'ECDSA', namedCurve: 'secp256k1', hash: { name: 'SHA-256' } },
      cryptoFactory: new CryptoFactory(keyStore, subtle)
    };
    const generate = new SubtleCryptoExtension(options.cryptoFactory);

    const privateKey = (<CryptoKeyPair>await generate.generateKey(options.algorithm, true, ['sign', 'verify'])).privateKey;
    const jwk: any = await generate.exportKey('jwk', privateKey);

    (<any>jwk).alg = 'ES256K';
    (<any>jwk).defaultSignAlgorithm = 'ES256K';

    await keyStore.save(new KeyReference('key'), jwk);
    const jwsToken = new JwsToken(options);
    const signature = await jwsToken.sign(new KeyReference('key'), Buffer.from(payload), ProtectionFormat.JwsCompactJson);
    expect(signature).toBeDefined();
    const serialized = signature.serialize();
    expect(serialized.split('.').length).toEqual(3);
    const token = JwsToken.deserialize(serialized);
    expect(token.payload.length).toEqual(12);
  });

  it('should create a jws token with JWT header', async () => {
    const payload = 'test payload';
    const keyStore = new KeyStoreInMemory();
    const seedReference = 'seed';
    await keyStore.save(new KeyReference(seedReference), new OctKey('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'));
    const subtle = SubtleCryptoNode.getSubtleCrypto();
    const options: IJwsSigningOptions = {
      protected: new TSMap([['typ', 'JWT']]),
      algorithm: <Algorithm>{ name: 'ECDSA', namedCurve: 'secp256k1', hash: { name: 'SHA-256' } },
      cryptoFactory: new CryptoFactory(keyStore, subtle)
    };
    const generate = new SubtleCryptoExtension(options.cryptoFactory);

    const privateKey = await generate.generatePairwiseKey(options.algorithm, seedReference, 'did:personaId', 'did:peerId');
    (<any>privateKey).alg = 'ES256K';
    (<any>privateKey).defaultSignAlgorithm = 'ES256K';

    await keyStore.save(new KeyReference('key'), privateKey);
    const jwsToken = new JwsToken(options);
    const signature = await jwsToken.sign(new KeyReference('key'), Buffer.from(payload), ProtectionFormat.JwsGeneralJson);
    expect((<TSMap<string, string>>signature.signatures[0].protected).get('typ')).toEqual('JWT');
  });
  it('should create a jws token by means of key reference options', async () => {
    const payload = 'test payload';
    const keyStore = new KeyStoreInMemory();
    const seedReference = 'seed';
    await keyStore.save(new KeyReference(seedReference), new OctKey('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'));
    const subtle = SubtleCryptoNode.getSubtleCrypto();
    const options: IJwsSigningOptions = {
      algorithm: <Algorithm>{ name: 'ECDSA', namedCurve: 'secp256k1', hash: { name: 'SHA-256' } },
      cryptoFactory: new CryptoFactory(keyStore, subtle)
    };
    const generate = new SubtleCryptoExtension(options.cryptoFactory);

    const privateKey = await generate.generatePairwiseKey(options.algorithm, seedReference, 'did:personaId', 'did:peerId');
    (<any>privateKey).alg = 'ES256K';
    (<any>privateKey).defaultSignAlgorithm = 'ES256K';

    await keyStore.save(new KeyReference('key'), privateKey);
    const jwsToken = new JwsToken(options);
    const signature = await jwsToken.sign(new KeyReference('key'), Buffer.from(payload), ProtectionFormat.JwsGeneralJson);
    expect(signature).toBeDefined();
  });
  it('should create, validate and serialize a JwsToken', async () => {
    const payload = 'The true sign of intelligence is not knowledge but imagination.';
    const keyStore = new KeyStoreInMemory();
    await keyStore.save(new KeyReference('seed'), new OctKey('ABEE'));
    const cryptoFactory = new CryptoFactory(keyStore, SubtleCryptoNode.getSubtleCrypto())
    const options: IPayloadProtectionOptions = {
      cryptoFactory,
      options: new TSMap<string, any>([
        [JoseConstants.optionProtectedHeader, new TSMap([['typ', 'JWT']])]
      ]),
      payloadProtection: new JoseProtocol()
    };

    const alg = { name: 'RSASSA-PKCS1-V1_5', hash: 'SHA-256', modulusLength: 2048, publicExponent: new Uint8Array([0x01, 0x00, 0x01]) };
    const generator = new SubtleCryptoExtension(cryptoFactory);
    const privateKey = await generator.generatePairwiseKey(alg, 'seed', 'persona', 'peer');
    expect((<any>privateKey).alg).toBeUndefined();
    (<any>privateKey).alg = 'RS256';
    await keyStore.save(new KeyReference('key'), privateKey);

    // sign
    const signature = await options.payloadProtection.sign(new KeyReference('key'), Buffer.from(payload), 'JwsGeneralJson', options);
    const signatures = signature.get(JoseConstants.tokenSignatures);
    expect((<TSMap<string, string>>signatures[0].protected).get('typ')).toEqual('JWT');
    expect((<TSMap<string, string>>signatures[0].protected).get('alg')).toEqual((<any>privateKey).alg);
    expect((<TSMap<string, string>>signatures[0].protected).get('kid')).toEqual('#key1');
    expect(signatures[0].signature).toBeDefined();
    expect(signature.get(JoseConstants.tokenPayload)).toEqual(Buffer.from(payload));

    // serialize
    let serialized = options.payloadProtection.serialize(signature, 'JwsGeneralJson', options);
    let parsed = JSON.parse(serialized);
    expect(parsed['payload']).toBeDefined();
    expect(parsed['signatures']).toBeDefined();

    // deserialize
    let deserialized = options.payloadProtection.deserialize(serialized, 'JwsGeneralJson', options);
    let deSignatures = deserialized.get(JoseConstants.tokenSignatures);
    expect(deSignatures[0].protected).toEqual(signatures[0].protected);
    expect(deSignatures[0].signature).toEqual(signatures[0].signature);
    expect(deserialized.get(JoseConstants.tokenPayload)).toEqual(signature.get(JoseConstants.tokenPayload));
    let staticDeserialize = JoseProtocol.deserialize(serialized, options);
    expect(deserialized).toEqual(staticDeserialize);

    // validate
    const publicKeyContainer = (await keyStore.get(new KeyReference('key'), new KeyStoreOptions({ publicKeyOnly: true }))).getKey<PublicKey>();
    const result = await options.payloadProtection.verify([publicKeyContainer], Buffer.from(payload), signature, options);
    expect(result.result).toBeTruthy();

    // Flat serialization
    serialized = options.payloadProtection.serialize(signature, 'JwsFlatJson', options);
    parsed = JSON.parse(serialized);
    expect(parsed['payload']).toBeDefined();
    expect(parsed['protected']).toBeDefined();
    expect(parsed['signature']).toBeDefined();

    deserialized = options.payloadProtection.deserialize(serialized, 'JwsFlatJson', options);
    deSignatures = deserialized.get(JoseConstants.tokenSignatures);
    expect(deSignatures[0].protected).toEqual(signatures[0].protected);
    expect(deSignatures[0].signature).toEqual(signatures[0].signature);
    expect(deserialized.get(JoseConstants.tokenPayload)).toEqual(signature.get(JoseConstants.tokenPayload));
    staticDeserialize = JoseProtocol.deserialize(serialized, options);
    expect(deserialized).toEqual(staticDeserialize);

    // Compact serialization
    serialized = options.payloadProtection.serialize(signature, 'JwsCompactJson', options);
    parsed = serialized.split('.');
    expect(parsed.length).toEqual(3);

    deserialized = options.payloadProtection.deserialize(serialized, 'JwsCompactJson', options);
    deSignatures = deserialized.get(JoseConstants.tokenSignatures);
    expect(deSignatures[0].protected).toEqual(signatures[0].protected);
    expect(deSignatures[0].signature).toEqual(signatures[0].signature);
    expect(deserialized.get(JoseConstants.tokenPayload)).toEqual(signature.get(JoseConstants.tokenPayload));
    staticDeserialize = JoseProtocol.deserialize(serialized, options);
    expect(deserialized).toEqual(staticDeserialize);

    // negative cases
    let getProtectionFormatSpy: jasmine.Spy = spyOn(<JoseProtocol>options.payloadProtection, 'getProtectionFormat').and.callFake(() => {
      throw new Error('spy bad format');
    });
    try {
      options.payloadProtection.serialize(signature, 'JwsCompactJson', options);
    } catch (exception) {
      expect(exception.message).toEqual('spy bad format');
    }
    try {
      options.payloadProtection.deserialize(serialized, 'JwsCompactJson', options);
    } catch (exception) {
      expect(exception.message).toEqual('spy bad format');
    }
    getProtectionFormatSpy.and.callFake(() => {
      return 'aaa';
    });
    try {
      options.payloadProtection.serialize(signature, 'JwsCompactJson', options);
    } catch (exception) {
      expect(exception.message).toEqual( `Serialization format 'aaa' is not supported`);
    }
    try {
      options.payloadProtection.deserialize(serialized, 'JwsCompactJson', options);
    } catch (exception) {
      expect(exception.message).toEqual(`Serialization format 'aaa' is not supported`);
    }
  });

  // tslint:disable-next-line: max-func-body-length
  it('should set headers in JwsToken', async () => {
    const payload = 'The true sign of intelligence is not knowledge but imagination.';
    const keyStore = new KeyStoreInMemory();
    await keyStore.save(new KeyReference('seed'), new OctKey('ABEE'));
    const cryptoFactory = new CryptoFactory(keyStore, SubtleCryptoNode.getSubtleCrypto())
    const options: IPayloadProtectionOptions = {
      cryptoFactory: cryptoFactory,
      options: new TSMap<string, any>([
        [JoseConstants.optionHeader, new TSMap([['test', 'ES256K']])],
        [JoseConstants.optionProtectedHeader, new TSMap([['test', 'elo'], ['kid', 'random']])]
      ]),
      payloadProtection: new JoseProtocol()
    };

    const alg = { name: 'ECDSA', namedCurve: 'secp256k1', hash: { name: 'SHA-256' }, format: 'DER' };
    const generator = new SubtleCryptoExtension(cryptoFactory);
    const privateKey = await generator.generatePairwiseKey(alg, 'seed', 'persona', 'peer');
    (<any>privateKey).alg = 'ES256K';
    await keyStore.save(new KeyReference('key'), privateKey);
    let publicKey = await keyStore.get(new KeyReference('key'));

    // sign
    const signature = await options.payloadProtection.sign(new KeyReference('key'), Buffer.from(payload), 'JwsGeneralJson', options);
    const signatures = signature.get(JoseConstants.tokenSignatures);
    expect(signatures[0].protected.get('test')).toEqual('elo');
    expect(signatures[0].protected.get('kid')).toEqual('random');
    expect(signatures[0].header.get('test')).toEqual('ES256K');
    expect(signatures[0].signature).toBeDefined();
    expect(signature.get(JoseConstants.tokenPayload)).toEqual(Buffer.from(payload));

    // serialize
    let serialized = options.payloadProtection.serialize(signature, 'JwsGeneralJson', options);
    let parsed = JSON.parse(serialized);
    expect(parsed['payload']).toBeDefined();
    expect(parsed['signatures']).toBeDefined();

    // deserialize
    let deserialized = options.payloadProtection.deserialize(serialized, 'JwsGeneralJson', options);
    let deSignatures = deserialized.get(JoseConstants.tokenSignatures);
    expect(deSignatures[0].protected).toEqual(signatures[0].protected);
    expect(deSignatures[0].header).toEqual(signatures[0].header);
    expect(deSignatures[0].signature).toEqual(signatures[0].signature);
    expect(deserialized.get(JoseConstants.tokenPayload)).toEqual(signature.get(JoseConstants.tokenPayload));

    // validate
    const publicKeyContainer = (await keyStore.get(new KeyReference('key'), new KeyStoreOptions({ publicKeyOnly: true }))).getKey<PublicKey>();
    const result = await options.payloadProtection.verify([publicKeyContainer], Buffer.from(payload), signature, options);
    expect(result.result).toBeTruthy();

    // Flat serialization
    serialized = options.payloadProtection.serialize(signature, 'JwsFlatJson', options);
    parsed = JSON.parse(serialized);
    expect(parsed['payload']).toBeDefined();
    expect(parsed['protected']).toBeDefined();
    expect(parsed['header']).toBeDefined();
    expect(parsed['signature']).toBeDefined();

    deserialized = options.payloadProtection.deserialize(serialized, 'JwsFlatJson', options);
    deSignatures = deserialized.get(JoseConstants.tokenSignatures);
    expect(deSignatures[0].protected).toEqual(signatures[0].protected);
    expect(deSignatures[0].header).toEqual(signatures[0].header);
    expect(deSignatures[0].signature).toEqual(signatures[0].signature);
    expect(deserialized.get(JoseConstants.tokenPayload)).toEqual(signature.get(JoseConstants.tokenPayload));

    // Compact serialization
    serialized = options.payloadProtection.serialize(signature, 'JwsCompactJson', options);
    parsed = serialized.split('.');
    expect(parsed.length).toEqual(3);

    deserialized = options.payloadProtection.deserialize(serialized, 'JwsCompactJson', options);
    deSignatures = deserialized.get(JoseConstants.tokenSignatures);
    expect(deSignatures[0].protected).toEqual(signatures[0].protected);
    expect(deSignatures[0].signature).toEqual(signatures[0].signature);
    expect(deserialized.get(JoseConstants.tokenPayload)).toEqual(signature.get(JoseConstants.tokenPayload));

    // negative cases
    let throwed = false;
    try {
      options.payloadProtection.serialize(signature, 'bluesky', options);
    } catch (err) {
      throwed = true;
      expect(err.message).toEqual(`Format 'bluesky' is not supported`);
    }
    expect(throwed).toBeTruthy();

    throwed = false;
    try {
      options.payloadProtection.deserialize(serialized, 'bluesky', options);
    } catch (err) {
      throwed = true;
      expect(err.message).toEqual(`Format 'bluesky' is not supported`);
    }
    expect(throwed).toBeTruthy();

    const sigs = signature.get(JoseConstants.tokenSignatures);
    sigs[0].protected.set('alg', '');
    throwed = false;
    try {
      await options.payloadProtection.verify([publicKey], Buffer.from(payload), signature, options);
    } catch (err) {
      expect(err.message).toEqual('Unable to validate signature as no signature algorithm has been specified in the header.');
      throwed = true;
    }
    expect(throwed).toBeTruthy();
  });
});
