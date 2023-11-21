const { ethers, deployments } = require("hardhat")

const PRICE = ethers.parseEther("0.1")

async function mintAndList() {
    const accounts = await ethers.getSigners()
    const deployer = accounts[0]
    const nftMaketPlaceInfo = await deployments.get("NftMarketplace")
    const basicNftInfo = await deployments.get("BasicNft")
    const nftMarketplace = await ethers.getContractAt(
        "NftMarketplace",
        nftMaketPlaceInfo.address,
        deployer,
    )
    const basicNft = await ethers.getContractAt("BasicNft", basicNftInfo.address, deployer)
    console.log("Minting...")
    const mintTx = await basicNft.mintNft()
    const mintTxReceipt = await mintTx.wait(1)
    const tokenId = mintTxReceipt.logs[0].args.tokenId
    console.log("Approving Nft...")

    const approvalTx = await basicNft.approve(nftMarketplace.target, tokenId)
    await approvalTx.wait(1)
    console.log("Listing NFT...")
    const tx = await nftMarketplace.listItem(basicNft.target, tokenId, PRICE)
    await tx.wait(1)
    console.log("Listed!")
}

mintAndList()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
