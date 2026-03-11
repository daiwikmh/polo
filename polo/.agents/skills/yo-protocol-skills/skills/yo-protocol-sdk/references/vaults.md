# Vault Registry & Contract Addresses

## Contract Addresses

| Contract                     | Address                                      |
| ---------------------------- | -------------------------------------------- |
| **Gateway**                  | `0xF1EeE0957267b1A474323Ff9CfF7719E964969FA` |
| **Vault Registry**           | `0x56c3119DC3B1a75763C87D5B0A2C55E489502232` |
| **Oracle**                   | `0x6E879d0CcC85085A709eBf5539224f53d0D396B0` |
| **Redeemer**                 | `0x0439e941841f97dc1334d1a433379c6fcdcc2162` |
| **Merkl Distributor** (Base) | `0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae` |
| **Merkl Creator**            | `0x8C9200d94Cf7A1B201068c4deDa6239F15FED480` |
| **YO Token** (Base)          | `0x3C1a1c9C2D073E5bC4e7AF97f0d7caC7a82E2262` |

Merkl API base: `https://api.merkl.xyz/v4`
REST API base: `https://api.yo.xyz`

## Supported Chains

| Chain    | ID      | Network Name |
| -------- | ------- | ------------ |
| Ethereum | `1`     | `ethereum`   |
| Base     | `8453`  | `base`       |
| Arbitrum | `42161` | `arbitrum`   |

Type: `SupportedChainId = 1 | 8453 | 42161`

## Vault Registry

When displaying vaults or user positions in any UI, always include the token logo image.

### yoETH

- **Address**: `0x3a43aec53490cb9fa922847385d82fe25d0e9de7`
- **Logo**: `https://assets.coingecko.com/coins/images/54932/standard/yoETH.png`
- **Underlying**: WETH (18 decimals)
- **Chains**: Ethereum, Base
- **Token addresses**:
  - Ethereum (1): `0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2`
  - Base (8453): `0x4200000000000000000000000000000000000006`

### yoBTC

- **Address**: `0xbcbc8cb4d1e8ed048a6276a5e94a3e952660bcbc`
- **Logo**: `https://assets.coingecko.com/coins/images/55189/standard/yoBTC.png`
- **Underlying**: cbBTC (8 decimals)
- **Chains**: Ethereum, Base
- **Token addresses**:
  - Ethereum (1): `0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf`
  - Base (8453): `0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf`

### yoUSD

- **Address**: `0x0000000f2eb9f69274678c76222b35eec7588a65`
- **Logo**: `https://assets.coingecko.com/coins/images/55386/standard/yoUSD.png`
- **Underlying**: USDC (6 decimals)
- **Chains**: Ethereum, Base, Arbitrum
- **Token addresses**:
  - Ethereum (1): `0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`
  - Base (8453): `0x833589fcd6edb6e08f4c7c32d4f71b54bda02913`
  - Arbitrum (42161): `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`

### yoEUR

- **Address**: `0x50c749ae210d3977adc824ae11f3c7fd10c871e9`
- **Logo**: `https://assets.coingecko.com/coins/images/68746/standard/yoEUR_color.png`
- **Underlying**: EURC (6 decimals)
- **Chains**: Ethereum, Base
- **Token addresses**:
  - Ethereum (1): `0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c`
  - Base (8453): `0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42`

### yoGOLD

- **Address**: `0x586675A3a46B008d8408933cf42d8ff6c9CC61a1`
- **Logo**: `https://assets.coingecko.com/coins/images/69957/standard/yoGOLD.png`
- **Underlying**: XAUt (6 decimals)
- **Chains**: Ethereum only
- **Token addresses**:
  - Ethereum (1): `0x68749665FF8D2d112Fa859AA293F07A622782F38`

### yoUSDT

- **Address**: `0xb9a7da9e90d3b428083bae04b860faa6325b721e`
- **Logo**: `https://assets.coingecko.com/coins/images/55386/standard/yoUSD.png`
- **Underlying**: USDT (6 decimals)
- **Chains**: Ethereum only
- **Token addresses**:
  - Ethereum (1): `0xdac17f958d2ee523a2206206994597c13d831ec7`

## Programmatic Access

```ts
import { VAULTS, getVaultsForChain, getVaultByAddress, YO_GATEWAY_ADDRESS } from '@yo-protocol/core'

// Get all vaults for a chain
const baseVaults = getVaultsForChain(8453)

// Look up by address
const vault = getVaultByAddress('0x0000000f2eb9f69274678c76222b35eec7588a65')

// Get underlying token address for a specific chain
const usdcOnBase = VAULTS.yoUSD.underlying.address[8453]
```
