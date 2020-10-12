/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ClientSecretCredential } from '@azure/identity';
import { JoseBuilder, CryptoBuilder, IPayloadProtectionSigning, CryptographicKey, ProtectionFormat, Jose, KeyUse, KeyStoreOptions, JsonWebKey, KeyReference } from '../lib/index';
import Credentials from './Credentials';

describe('Jose', () => {
    const random = (length: number) => Math.random().toString(36).substring(2, length + 2);

    let originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
    beforeEach(async () => {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;
    });

    afterEach(() => {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
    });
    const cryptoNode = new CryptoBuilder()
        .useSigningKeyReference(new KeyReference('neo'))
        .useDid('did')
        .build();

    // Loop through these crypto factories. If no credentials for Key Vault are present, we skip key vault
    let factories = [cryptoNode];
    //const alg = { name: 'ECDSA', namedCurve: 'secp256k1', hash: { name: 'SHA-256' } };

    if (Credentials.vaultUri.startsWith('https')) {
        const credentials = new ClientSecretCredential(Credentials.tenantGuid, Credentials.clientId, Credentials.clientSecret);
        const remote = 'remote-neo';
        const cryptoKeyVault = new CryptoBuilder()
            .useKeyVault(credentials, Credentials.vaultUri)
            .useSigningKeyReference(new KeyReference('neo', 'key', remote))
            .useDid('did')
            .build();
        factories = [cryptoKeyVault, cryptoNode];
    } else {
        console.log('Enter your key vault credentials in Credentials.ts to enable key vault testing')
    }

    it('should create a builder', () => {
        const crypto = new CryptoBuilder().build();
        const builder = new JoseBuilder(crypto);
        const jose = builder.build();
        expect(jose.builder.crypto).toEqual(crypto);
        expect(jose.builder.jwtProtocol).toBeUndefined();
        expect(jose.builder.protectedHeader).toEqual({ typ: 'JWT' });
        expect(jose.builder.unprotectedHeader).toEqual({});
        expect(jose.builder.protocol).toEqual('JOSE');
        expect(jose.builder.serializationFormat).toEqual('JwsCompactJson');
        expect(jose.constructor.name).toEqual('Jose');

    });

    it('should sign and verify', async () => {
        const payload = Buffer.from('The only way you can survive is to spread to another area. There is another organism on this planet that follows the same pattern. Do you know what it is? A virus. Human beings are a disease. A cancer of this planet.');

        for (let inx = 0; inx < factories.length; inx++) {
            let crypto = factories[inx];
            console.log(`Using crypto ${crypto.builder.cryptoFactory.constructor.name}`);

            // Generate and save a signing key
            crypto = await crypto.generateKey(KeyUse.Signature);

            let jose: IPayloadProtectionSigning = new JoseBuilder(crypto)
                .build();

            jose = await jose.sign(payload);

            // Check kid
            let serialized = await jose.serialize();
            jose = await jose.deserialize(serialized);
            expect(jose.signatureProtectedHeader['typ']).toEqual('JWT');
            expect(jose.signatureProtectedHeader.alg).toEqual('ES256K');
            expect(jose.signatureProtectedHeader.kid).toEqual('did#neo');

            jose = (<Jose>jose).builder
                .useKid('kid')
                .build();

            expect((<Jose>jose).builder.kid).toEqual('kid');
            jose = await jose.sign(payload);
            serialized = await jose.serialize();
            jose = await jose.deserialize(serialized);
            expect(jose.signatureProtectedHeader!.typ).toEqual('JWT');
            expect(jose.signatureProtectedHeader!.alg).toEqual('ES256K');
            expect(jose.signatureProtectedHeader!.kid).toEqual('kid');

            const jwkPublic = (await crypto.builder.keyStore.get(crypto.builder.signingKeyReference!, new KeyStoreOptions({ publicKeyOnly: true }))).getKey<JsonWebKey>();

            const validated = await jose.verify([jwkPublic]);
            expect(validated).toBeTruthy();

            // negative cases
            jose = (<Jose>jose).builder
                .useSerializationFormat('whatever')
                .build();

            try {
                await jose.serialize();
                fail('serializationFormat should fail');
            } catch (e) {
                expect(e.message).toEqual(`Format 'whatever' is not supported`)
            }
            try {
                await jose.deserialize(serialized);
                fail('deserializationFormat should fail');
            } catch (e) {
                expect(e.message).toEqual(`Format 'whatever' is not supported`)
            }

            // verify has no token
            jose = new JoseBuilder(crypto).build();
            try {
                await jose.verify([jwkPublic]);
                fail('no token should fail');
            } catch (ex) {
                expect(ex).toEqual('Import a token by deserialize');
            }

            // serialize has no token
            jose = new JoseBuilder(crypto).build();
            try {
                await jose.serialize();
                fail('no token to serialize should fail');
            } catch (ex) {
                expect(ex).toEqual('No token to serialize');
            }
        }
    });


    it('should sign and verify with JWT protocol', async () => {
        const payload = {
            firstName: 'Jules',
            lastName: 'Winnfield'
        };

        let crypto = cryptoNode;

        // Generate and save a signing key
        crypto = await crypto.generateKey(KeyUse.Signature);

        let jose: IPayloadProtectionSigning = new JoseBuilder(crypto)
            .useJwtProtocol({ someProp: 1 })
            .build();

        jose = await jose.sign(payload);

        // Check kid
        let serialized = await jose.serialize();
        jose = await jose.deserialize(serialized);
        expect(jose.signatureProtectedHeader['typ']).toEqual('JWT');
        expect(jose.signatureProtectedHeader.alg).toEqual('ES256K');
        expect(jose.signatureProtectedHeader.kid).toEqual('did#neo');
        let signedPayload: any = JSON.parse(jose.signaturePayload!.toString('utf-8'));
        expect(signedPayload.someProp).toEqual(1);
        expect(signedPayload.jti).toBeDefined();
        expect(signedPayload.exp).toBeDefined();
        expect(signedPayload.nbf).toBeDefined();

        try {
            await jose.sign(Buffer.from(JSON.stringify(payload)));
            fail('Should have throwed exception');
        } catch (exception) {
            expect(exception).toEqual('Input to sign JWT must be an object');
        }
    });

    it('should check ProtectionFormat', () => {
        expect(Jose.getProtectionFormat('jwsflatjson')).toEqual(ProtectionFormat.JwsFlatJson);
        expect(Jose.getProtectionFormat('JwsCompactJson')).toEqual(ProtectionFormat.JwsCompactJson);
        expect(Jose.getProtectionFormat('JwsGeneralJson')).toEqual(ProtectionFormat.JwsGeneralJson);
        expect(Jose.getProtectionFormat('JweFlatJson')).toEqual(ProtectionFormat.JweFlatJson);
        expect(Jose.getProtectionFormat('JweCompactJson')).toEqual(ProtectionFormat.JweCompactJson);
        expect(Jose.getProtectionFormat('JweGeneralJson')).toEqual(ProtectionFormat.JweGeneralJson);
        expect(() => Jose.getProtectionFormat('xxx')).toThrowError(`Format 'xxx' is not supported`);
    });
});