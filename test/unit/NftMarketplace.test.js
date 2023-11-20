const { assert, expect } = require("chai")
const { network, deployments, ethers, getNamedAccounts } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Nft Marketplace Tests", () => {
          let nftMarketPlace, basicNft, deployer, player
          const PRICE = ethers.parseEther("0.1")
          const TOKEN_ID = 0
          beforeEach(async () => {
              //deployer = (await getNamedAccounts()).deployer
              //player = (await getNamedAccounts()).player
              const accounts = await ethers.getSigners()
              deployer = accounts[0]
              player = accounts[1]
              await deployments.fixture(["all"])
              let nftMarketplaceInfo = await deployments.get("NftMarketplace")
              let basicNftInfo = await deployments.get("BasicNft")
              nftMarketPlace = await ethers.getContractAt(
                  "NftMarketplace",
                  nftMarketplaceInfo.address,
                  deployer,
              )
              basicNft = await ethers.getContractAt("BasicNft", basicNftInfo.address, deployer)
              // ethers.getContractAt by default links the contract instance returned to the account passed as 3rd param (in this case the deployer)
              // if we want to call functions of the contract with a different account we have to connect the contract instance with that account explicitely..
              // One way to do it is.. nftMarketPlace = await nftMarketPlace.connect(player)
              await basicNft.mintNft()
              // Now we have to authorize nftMarketplace contract to transfer the NFT.. as right after minting, only the deployer (owner of BasicNft) is authorized to call transfer on the Nft.
              await basicNft.approve(nftMarketPlace.target, TOKEN_ID)
          })

          it("lists and can be bought", async () => {
              await nftMarketPlace.listItem(basicNft.target, TOKEN_ID, PRICE)
              const playerConnectedNftMarketplace = await nftMarketPlace.connect(player)
              await playerConnectedNftMarketplace.buyItem(basicNft.target, TOKEN_ID, {
                  value: PRICE,
              })
              const newOwner = await basicNft.ownerOf(TOKEN_ID)
              const deployerProceeds = await nftMarketPlace.getProceeds(deployer)
              assert(newOwner.toString() == player.address)
              assert(deployerProceeds.toString() == PRICE.toString())
          })
      })
