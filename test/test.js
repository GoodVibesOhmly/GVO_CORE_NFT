describe("Test", () => {
    it("Test1", async () => {
        var code = `contract Test {

            event Testo();

            function test() external {
                emit Testo();
                uint256[] memory t;
                t[0] = 50;
            }
        }`;

        var Test = await compile(code, 'Test');
        var test = await new web3.eth.Contract(Test.abi).deploy({data : Test.bin}).send(blockchainConnection.getSendingOptions());

        await test.methods.test().send(blockchainConnection.getSendingOptions());
    })
})