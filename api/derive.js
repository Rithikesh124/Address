const bip39 = require('bip39');
const { BIP32Factory } = require('bip32');
const ecc = require('tiny-secp256k1');
const bitcoin = require('bitcoinjs-lib');
const coinConstants = require('bip44-constants');

const bip32 = BIP32Factory(ecc);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { mnemonic, coins, count = 10 } = req.body;

    if (!bip39.validateMnemonic(mnemonic)) {
        return res.status(400).json({ error: 'Invalid Mnemonic' });
    }

    try {
        const seed = await bip39.mnemonicToSeed(mnemonic);
        const root = bip32.fromSeed(seed);
        const results = {};

        // Convert coin names to constants (e.g., "BTC" -> 0)
        const coinMap = {};
        coinConstants.forEach(c => { coinMap[c[1]] = c[0]; });

        coins.forEach(coinTicker => {
            const coinCode = coinMap[coinTicker.toUpperCase()] || 0;
            const coinResults = [];
            
            // BIP84 Path: m / 84' / coin_type' / 0' / 0 / index
            const path = `m/84'/${coinCode}'/0'/0`;
            const accountNode = root.derivePath(path);

            for (let i = 0; i < count; i++) {
                const child = accountNode.derive(i);
                
                // Logic for Native SegWit (Bech32)
                const { address } = bitcoin.payments.p2wpkh({
                    pubkey: child.publicKey,
                    network: bitcoin.networks.bitcoin // Extendable for Altcoin networks
                });

                coinResults.push({ index: i, address });
            }
            results[coinTicker] = coinResults;
        });

        return res.status(200).json(results);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
