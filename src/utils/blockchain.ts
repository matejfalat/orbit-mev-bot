import {
  createPublicClient,
  createWalletClient,
  http,
  isHex,
  webSocket,
} from 'viem'
import {privateKeyToAccount} from 'viem/accounts'
import {blast} from 'viem/chains'

export const getPublicClient = () =>
  createPublicClient({
    chain: blast,
    transport: http('https://rpc.envelop.is/blast'),
  })

export const getWebSocketPublicClient = () =>
  createPublicClient({
    chain: blast,
    transport: webSocket('wss://blast-rpc.publicnode.com'),
  })

const privateKey = process.env.WALLET_PRIVATE_KEY

export const walletAccount =
  privateKey && isHex(privateKey) ? privateKeyToAccount(privateKey) : undefined

export const getWalletClient = () =>
  createWalletClient({
    account: walletAccount,
    chain: blast,
    transport: http('https://rpc.envelop.is/blast'),
  })
