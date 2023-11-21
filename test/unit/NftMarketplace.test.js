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
              user = accounts[1]
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
              const playerConnectedNftMarketplace = await nftMarketPlace.connect(user)
              await playerConnectedNftMarketplace.buyItem(basicNft.target, TOKEN_ID, {
                  value: PRICE,
              })
              const newOwner = await basicNft.ownerOf(TOKEN_ID)
              const deployerProceeds = await nftMarketPlace.getProceeds(deployer)
              assert(newOwner.toString() == user.address)
              assert(deployerProceeds.toString() == PRICE.toString())
          })

          describe("listItem", function () {
              it("emits an event after listing an item", async function () {
                  expect(await nftMarketPlace.listItem(basicNft.target, TOKEN_ID, PRICE)).to.emit(
                      "ItemListed",
                  )
              })
              it("exclusively items that haven't been listed", async function () {
                  await nftMarketPlace.listItem(basicNft.target, TOKEN_ID, PRICE)
                  const error = `NftMarketplace__AlreadyListed`
                  //   await expect(
                  //       nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  //   ).to.be.revertedWith("AlreadyListed")
                  await expect(
                      nftMarketPlace.listItem(basicNft.target, TOKEN_ID, PRICE),
                  ).to.be.revertedWithCustomError(nftMarketPlace, error)
              })
              it("exclusively allows owners to list", async function () {
                  nftMarketPlace = nftMarketPlace.connect(user)
                  await basicNft.approve(user.address, TOKEN_ID)
                  await expect(
                      nftMarketPlace.listItem(basicNft.target, TOKEN_ID, PRICE),
                  ).to.be.revertedWithCustomError(nftMarketPlace, "NftMarketplace__NotOwner")
              })
              it("needs approvals to list item", async function () {
                  await basicNft.approve(ethers.ZeroAddress, TOKEN_ID)
                  await expect(
                      nftMarketPlace.listItem(basicNft.target, TOKEN_ID, PRICE),
                  ).to.be.revertedWithCustomError(
                      nftMarketPlace,
                      "NftMarketplace__NotApprovedForMarketplace",
                  )
              })
              it("Updates listing with seller and price", async function () {
                  await nftMarketPlace.listItem(basicNft.target, TOKEN_ID, PRICE)
                  const listing = await nftMarketPlace.getListing(basicNft.target, TOKEN_ID)
                  assert(listing.price.toString() == PRICE.toString())
                  assert(listing.seller.toString() == deployer.address)
              })
              it("reverts if the price be 0", async () => {
                  const ZERO_PRICE = ethers.parseEther("0")
                  await expect(
                      nftMarketPlace.listItem(basicNft.target, TOKEN_ID, ZERO_PRICE),
                  ).revertedWithCustomError(nftMarketPlace, "NftMarketplace__PriceMustBeAboveZero")
              })
          })
          describe("cancelListing", function () {
              it("reverts if there is no listing", async function () {
                  const error = `NftMarketplace__NotListed`
                  await expect(
                      nftMarketPlace.cancelListing(basicNft.target, TOKEN_ID),
                  ).to.be.revertedWithCustomError(nftMarketPlace, error)
              })
              it("reverts if anyone but the owner tries to call", async function () {
                  await nftMarketPlace.listItem(basicNft.target, TOKEN_ID, PRICE)
                  nftMarketPlace = nftMarketPlace.connect(user)
                  await basicNft.approve(user.address, TOKEN_ID)
                  await expect(
                      nftMarketPlace.cancelListing(basicNft.target, TOKEN_ID),
                  ).to.be.revertedWithCustomError(nftMarketPlace, "NftMarketplace__NotOwner")
              })
              it("emits event and removes listing", async function () {
                  await nftMarketPlace.listItem(basicNft.target, TOKEN_ID, PRICE)
                  expect(await nftMarketPlace.cancelListing(basicNft.target, TOKEN_ID)).to.emit(
                      "ItemCanceled",
                  )
                  const listing = await nftMarketPlace.getListing(basicNft.target, TOKEN_ID)
                  assert(listing.price.toString() == "0")
              })
          })
          describe("buyItem", function () {
              it("reverts if the item isnt listed", async function () {
                  await expect(
                      nftMarketPlace.buyItem(basicNft.target, TOKEN_ID),
                  ).to.be.revertedWithCustomError(nftMarketPlace, "NftMarketplace__NotListed")
              })
              it("reverts if the price isnt met", async function () {
                  await nftMarketPlace.listItem(basicNft.target, TOKEN_ID, PRICE)
                  await expect(
                      nftMarketPlace.buyItem(basicNft.target, TOKEN_ID),
                  ).to.be.revertedWithCustomError(nftMarketPlace, "NftMarketplace__PriceNotMet")
              })
              it("transfers the nft to the buyer and updates internal proceeds record", async function () {
                  await nftMarketPlace.listItem(basicNft.target, TOKEN_ID, PRICE)
                  nftMarketPlace = nftMarketPlace.connect(user)
                  expect(
                      await nftMarketPlace.buyItem(basicNft.target, TOKEN_ID, { value: PRICE }),
                  ).to.emit("ItemBought")
                  const newOwner = await basicNft.ownerOf(TOKEN_ID)
                  const deployerProceeds = await nftMarketPlace.getProceeds(deployer.address)
                  assert(newOwner.toString() == user.address)
                  assert(deployerProceeds.toString() == PRICE.toString())
              })
          })
          describe("updateListing", function () {
              it("must be owner and listed", async function () {
                  await expect(
                      nftMarketPlace.updateListing(basicNft.target, TOKEN_ID, PRICE),
                  ).to.be.revertedWithCustomError(nftMarketPlace, "NftMarketplace__NotListed")
                  await nftMarketPlace.listItem(basicNft.target, TOKEN_ID, PRICE)
                  nftMarketPlace = nftMarketPlace.connect(user)
                  await expect(
                      nftMarketPlace.updateListing(basicNft.target, TOKEN_ID, PRICE),
                  ).to.be.revertedWithCustomError(nftMarketPlace, "NftMarketplace__NotOwner")
              })
              it("reverts if new price is 0", async function () {
                  const updatedPrice = ethers.parseEther("0")
                  await nftMarketPlace.listItem(basicNft.target, TOKEN_ID, PRICE)
                  await expect(
                      nftMarketPlace.updateListing(basicNft.target, TOKEN_ID, updatedPrice),
                  ).to.be.revertedWithCustomError(
                      nftMarketPlace,
                      "NftMarketplace__PriceMustBeAboveZero",
                  )
              })
              it("updates the price of the item", async function () {
                  const updatedPrice = ethers.parseEther("0.2")
                  await nftMarketPlace.listItem(basicNft.target, TOKEN_ID, PRICE)
                  expect(
                      await nftMarketPlace.updateListing(basicNft.target, TOKEN_ID, updatedPrice),
                  ).to.emit("ItemListed")
                  const listing = await nftMarketPlace.getListing(basicNft.target, TOKEN_ID)
                  assert(listing.price.toString() == updatedPrice.toString())
              })
          })
          describe("withdrawProceeds", function () {
              it("doesn't allow 0 proceed withdrawls", async function () {
                  await expect(nftMarketPlace.withdrawProceeds()).to.be.revertedWithCustomError(
                      nftMarketPlace,
                      "NftMarketplace__NoProceeds",
                  )
              })
              it("withdraws proceeds", async function () {
                  await nftMarketPlace.listItem(basicNft.target, TOKEN_ID, PRICE)
                  nftMarketPlace = nftMarketPlace.connect(user)
                  await nftMarketPlace.buyItem(basicNft.target, TOKEN_ID, { value: PRICE })
                  nftMarketPlace = nftMarketPlace.connect(deployer)

                  const deployerProceedsBefore = await nftMarketPlace.getProceeds(deployer.address)
                  // getBalance is not a function of Signer anymore. From ethers v6 it is available on the provider.
                  const deployerBalanceBefore = await deployer.provider.getBalance(deployer.address)
                  const txResponse = await nftMarketPlace.withdrawProceeds()
                  const transactionReceipt = await txResponse.wait(1)
                  const { gasUsed, gasPrice } = transactionReceipt
                  const gasCost = gasUsed * gasPrice
                  const deployerBalanceAfter = await deployer.provider.getBalance(deployer.address)

                  assert(
                      (deployerBalanceAfter + gasCost).toString() ==
                          (deployerProceedsBefore + deployerBalanceBefore).toString(),
                  )
              })
          })
      })
