import {createPublicClient, createWalletClient, http, isHex} from 'viem'
import {privateKeyToAccount} from 'viem/accounts'
import {blast} from 'viem/chains'

export const getPublicClient = () =>
  createPublicClient({
    chain: blast,
    transport: http('https://rpc.envelop.is/blast'),
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
