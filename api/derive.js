const bip39 = require('bip39');
const { BIP32Factory } = require('bip32');
const ecc = require('@bitcoinerlab/secp256k1');
const bitcoin = require('bitcoinjs-lib');
const coinConstants = require('bip44-constants');

const bip32 = BIP32Factory(ecc);

// Mapping for popular Bech32 (SegWit) prefixes
const bech32Prefixes = {
    'BTC': 'bc',
    'LTC': 'ltc',
    'DOGE': 'doge',
    'VTC': 'vtc',
    'VIA': 'via',
    'DGB': 'dgb',
    'SYS': 'sys'
};

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { mnemonic, coins } = req.body;

    if (!mnemonic || !bip39.validateMnemonic(mnemonic)) {
        return res.status(400).json({ error: 'Invalid or missing mnemonic' });
    }

    try {
        const seed = await bip39.mnemonicToSeed(mnemonic);
        const root = bip32.fromSeed(seed);
        const results = {};

        // Map Tickers to BIP44 Coin Codes
        const tickerToCode = {};
        coinConstants.forEach(c => { tickerToCode[c[1].toUpperCase()] = c[0]; });

        for (const ticker of (coins || ['BTC'])) {
            const symbol = ticker.toUpperCase();
            const coinCode = tickerToCode[symbol] !== undefined ? tickerToCode[symbol] : 0;
            
            // BIP84 Path: m / 84' / coin_type' / 0' / 0 / 0 (Only Index 0)
            const path = `m/84'/${coinCode & 0x7FFFFFFF}'/0'/0/0`; 
            const child = root.derivePath(path);

            // Dynamically set network for the coin to fix address prefix
            // Default to lowercase ticker if not in mapping (e.g., 'ltc' for LTC)
            const network = {
                bech32: bech32Prefixes[symbol] || symbol.toLowerCase(),
                pubKeyHash: 0x00, // Placeholder
                scriptHash: 0x05, // Placeholder
                wif: 0x80,        // Placeholder
            };

            try {
                const { address } = bitcoin.payments.p2wpkh({
                    pubkey: child.publicKey,
                    network: network
                });
                results[symbol] = address;
            } catch (e) {
                results[symbol] = "Error generating SegWit address for this coin";
            }
        }

        return res.status(200).json({
            derivation: "BIP84 (Native SegWit)",
            index: 0,
            wallets: results
        });
    } catch (err) {
        return res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
            }
