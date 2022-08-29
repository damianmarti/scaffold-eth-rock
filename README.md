## 🏗 Morra Game

This is a commit/reveal game based on the Rock Paper Scissors branch https://github.com/danielkhoo/scaffold-eth/tree/rock-paper-scissors

Please refer to that branch for all the commit/reveal information.

More information about the Morra game at https://en.wikipedia.org/wiki/Morra_(game)

## 🤚 The Game

https://morra.surge.sh/

It's deployed on Polygon.

![morra home](https://user-images.githubusercontent.com/466652/187265011-ea28fd2b-bb49-4a70-866a-5cb0f8db3945.png)

![morra playing](https://user-images.githubusercontent.com/466652/187265050-11660e02-1e2b-4e6a-a019-007b504df27d.png)

![morra revealing](https://user-images.githubusercontent.com/466652/187265062-f18a97cc-bc88-4472-b2c5-d21ba2779ccb.png)

![morra win](https://user-images.githubusercontent.com/466652/187265124-b6c8098e-3c45-46f4-a59a-76ed515721f2.png)

## Setup

Prerequisites: [Node](https://nodejs.org/en/download/) plus [Yarn](https://classic.yarnpkg.com/en/docs/install/) and [Git](https://git-scm.com/downloads)

> Clone or fork the repo, checkout the morra-game branch:

```bash
git clone https://github.com/damianmarti/scaffold-eth-rock.git
git checkout morra-game
```

> install and start your 👷‍ Hardhat chain:

```bash
cd scaffold-eth-rock
yarn install
yarn chain
```

> in a second terminal window, start your 📱 frontend:

```bash
cd scaffold-eth-rock
yarn start
```

> in a third terminal window, 🛰 deploy your contract:

```bash
cd scaffold-eth-rock
yarn deploy
```

> The frontend use a subgraph to fetch the game data, you should start a subgraph node with:

```yarn run-graph-node```

and then build the subgraph:

```yarn graph-codegen
yarn graph-create-local
yarn graph-deploy-local
```


🔏 Edit your smart contract `Morra.sol` in `packages/hardhat/contracts`

📝 Edit your frontend `App.jsx` in `packages/react-app/src`

💼 Edit your deployment scripts in `packages/hardhat/deploy`

📱 Open http://localhost:3000 to see the app



