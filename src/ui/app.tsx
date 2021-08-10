/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-use-before-define */
import React, { useEffect, useState } from 'react';
import Web3 from 'web3';
import { ToastContainer, toast } from 'react-toastify';
import './styles/app.scss';
import 'react-toastify/dist/ReactToastify.css';
import { PolyjuiceHttpProvider } from '@polyjuice-provider/web3';
import { AddressTranslator, BridgeRPCHandler } from 'nervos-godwoken-integration';

import * as CompiledContractArtifact from '../../build/contracts/ERC20.json';
import { CONFIG } from '../config';
import Navbar from './components/navbar';

const SUDT_PROXY_CONTRACT_ADDRESS = '0x7C95a7fba1964bDb7a50cAB4d44bb30C20C9EfFF';
const FORCE_BRIDGE_URL =
    'https://force-bridge-test.ckbapp.dev/bridge/Ethereum/Nervos?xchain-asset=0x0000000000000000000000000000000000000000';
async function createWeb3() {
    // Modern dapp browsers...
    if ((window as any).ethereum) {
        const godwokenRpcUrl = CONFIG.WEB3_PROVIDER_URL;
        const providerConfig = {
            rollupTypeHash: CONFIG.ROLLUP_TYPE_HASH,
            ethAccountLockCodeHash: CONFIG.ETH_ACCOUNT_LOCK_CODE_HASH,
            web3Url: godwokenRpcUrl
        };

        const provider = new PolyjuiceHttpProvider(godwokenRpcUrl, providerConfig);
        const web3 = new Web3(provider || Web3.givenProvider);

        try {
            // Request account access if needed
            await (window as any).ethereum.enable();
        } catch (error) {
            toast.error('You rejected to connect metamask');
        }

        return web3;
    }

    console.log('Non-Ethereum browser detected. You should consider trying MetaMask!');
    return null;
}

export function App() {
    const [web3, setWeb3] = useState<Web3>(null);
    const [accounts, setAccounts] = useState<string[]>();
    const [l2Balance, setL2Balance] = useState<bigint>();
    const [deployTxHash, setDeployTxHash] = useState<string | undefined>();
    const [polyjuiceAddress, setPolyjuiceAddress] = useState<string | undefined>();
    const [transactionInProgress, setTransactionInProgress] = useState(false);
    const [depositAddress, setDepositAddress] = useState<string>('');
    const toastId = React.useRef(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [balanceOf, setBalanceOf] = useState<bigint>();

    useEffect(() => {
        if (accounts?.[0]) {
            const addressTranslator = new AddressTranslator();
            setPolyjuiceAddress(addressTranslator.ethAddressToGodwokenShortAddress(accounts?.[0]));
        } else {
            setPolyjuiceAddress(undefined);
        }
    }, [accounts?.[0]]);

    useEffect(() => {
        if (transactionInProgress && !toastId.current) {
            toastId.current = toast.info(
                'Transaction in progress. Confirm MetaMask signing dialog and please wait...',
                {
                    position: 'top-right',
                    autoClose: false,
                    hideProgressBar: false,
                    closeOnClick: false,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined,
                    closeButton: false
                }
            );
        } else if (!transactionInProgress && toastId.current) {
            toast.dismiss(toastId.current);
            toastId.current = null;
        }
    }, [transactionInProgress, toastId.current]);

    const account = accounts?.[0];

    useEffect(() => {
        if (web3) {
            return;
        }

        (async () => {
            const _web3 = await createWeb3();
            setWeb3(_web3);

            const _accounts = [(window as any).ethereum.selectedAddress];
            setAccounts(_accounts);

            console.log({ _accounts });

            if (_accounts && _accounts[0]) {
                const _l2Balance = BigInt(await _web3.eth.getBalance(_accounts[0]));
                setL2Balance(_l2Balance);
            }
        })();
    });

    const getSUDTBalance = async () => {
        const contract = new web3.eth.Contract(
            CompiledContractArtifact.abi as any,
            SUDT_PROXY_CONTRACT_ADDRESS
        );

        const _balanceOf = await contract.methods.balanceOf(polyjuiceAddress).call({
            from: accounts?.[0]
        });
        console.log('BALACE::', _balanceOf);
        setBalanceOf(_balanceOf);
    };

    const generateLayer2DepositAddress = async () => {
        setLoading(true);
        const addressTranslator = new AddressTranslator();
        const _depositAddress = await addressTranslator.getLayer2DepositAddress(
            web3,
            accounts?.[0]
        );

        console.log(`Layer 2 Deposit Address on Layer 1: \n${_depositAddress.addressString}`);

        setDepositAddress(_depositAddress.addressString);

        getSUDTBalance();
        setLoading(false);
    };

    const redirectToBridge = () => {
        window.location.href = FORCE_BRIDGE_URL;
    };

    const LoadingIndicator = () => <span className="rotating-icon">⚙️</span>;

    return (
        <div>
            <Navbar
                ethAccount={accounts?.[0]}
                polyAccount={polyjuiceAddress || ' - '}
                l2Balance={l2Balance}
            />
            <div className="app">
                {!depositAddress && (
                    <button onClick={generateLayer2DepositAddress}>
                        Get Layer2 Deposit Address
                    </button>
                )}

                {loading && <LoadingIndicator />}
                {!loading && depositAddress && (
                    <div>
                        <div className="show-addr mb-2">
                            {' '}
                            <h4>Layer 2 Deposit Address on Layer 1: </h4>
                            {depositAddress}
                        </div>

                        <div className="show-info mb-2">
                            <h4>What the heck is that?</h4>
                            <div>
                                A layer 2 Deposit address is an address on Nervos Layer 1 that acts
                                as a gateway into Layer 2. All CKBytes and SUDT tokens transferred
                                to this address on Layer 1 will be automatically collected by the
                                block producing nodes and delivered to Layer 2.
                            </div>
                        </div>

                        <div className="show-info mb-2">
                            <h4>What should I do?</h4>
                            <div className="mb-1">
                                Copy your Layer 2 to deposit address and go to the following link{' '}
                            </div>
                            <div>
                                <button onClick={redirectToBridge}> Go to Force Bridge</button>
                            </div>
                        </div>
                    </div>
                )}
                <ToastContainer />
            </div>
        </div>
    );
}
