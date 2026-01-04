const bip39 = require('bip39');
const { BIP32Factory } = require('bip32');
const ecc = require('@bitcoinerlab/secp256k1'); // Use this for Vercel compatibility
const bitcoin = require('bitcoinjs-lib');
const coinConstants = require('bip44-constants');

const bip32 = BIP32Factory(ecc);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { mnemonic, coins, count = 10 } = req.body;

    if (!mnemonic || !bip39.validateMnemonic(mnemonic)) {
        return res.status(400).json({ error: 'Invalid or missing mnemonic' });
    }

    try {
        // 1. Generate Master Seed
        const seed = await bip39.mnemonicToSeed(mnemonic);
        const root = bip32.fromSeed(seed);
        const results = {};

        // 2. Map Tickers to BIP44 Coin Codes
        const tickerToCode = {};
        coinConstants.forEach(c => { tickerToCode[c[1].toUpperCase()] = c[0]; });

        // 3. Process each requested coin
        for (const ticker of (coins || ['BTC'])) {
            const symbol = ticker.toUpperCase();
            const coinCode = tickerToCode[symbol] !== undefined ? tickerToCode[symbol] : 0;
            
            // BIP84 Path: m / 84' / coin_type' / 0' / 0 / index
            const path = `m/84'/${coinCode & 0x7FFFFFFF}'/0'/0`; 
            const accountNode = root.derivePath(path);

            const addresses = [];
            for (let i = 0; i < Math.min(count, 100); i++) {
                const child = accountNode.derive(i);
                
                // Generate Native SegWit (Bech32) address
                const { address } = bitcoin.payments.p2wpkh({
                    pubkey: child.publicKey,
                    network: bitcoin.networks.bitcoin // Standard for derivation; change if specific altcoin network needed
                });

                addresses.push({ index: i, address });
            }
            results[symbol] = addresses;
        }

        return res.status(200).json({
            mnemonic_valid: true,
            derivation: "BIP84 (Native SegWit)",
            wallets: results
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
                }
