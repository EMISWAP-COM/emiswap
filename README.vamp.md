# Vampiring contract README

Контракт предназначен для миграции ликвидности с других бирж на свои адреса. Контракт для работы с LP-токенами бирж Uniswap и Mooniswap.
Подробнее процесс вывода ликвидности продемонстрирован в коде теста test/EmiVamp.test.js

## Инициализация (конструктор initialize)

При инициализации передается следующие параметры:
 - массив адресов LP-токенов, который будут импортироваться в ликвидность;
 - массив соответствующих типов LP-токенов (0 - Uniswap, 1 - Mooniswap);
 - адрес нашего роутера для конвертации токенов;
 - адрес контракта Voting для смены роутера.

## Получение информации об имеющихся LP-токенах
Для получения информации обо всех имеющихся в контракте LP-токенах предусмотрен методы *lpTokensInfo*, *lpTokensInfoLength*
 и *lpTokenDetailedInfo*:
```solidity
    struct LPTokenInfo {
        address lpToken;
        uint16 tokenType; // Token type: 0 - uniswap (default), 1 - mooniswap
    }

    LPTokenInfo[] public lpTokensInfo;

    function lpTokensInfoLength() external view returns (uint256);
    function lpTokenDetailedInfo(uint256 _pid) external view returns (address, address);

```

Порядок получения списка токенов:
1. Вызываем метод *lpTokensInfoLength*, он возвращает количество элементов в массиве *lpTokensInfo*.
2. В цикле вызываем метод *lpTokensInfo*, указывая текущий индекс токена, от 0 до lpTokensInfoLength-1, получаем на выходе структуру из двух элементов: 
 адрес lpToken и его тип.
3. Получаем адреса базовых токенов lpToken: вызываем метод *lpTokenDetailedInfo* указывая индекс LP-токена. В ответ получаем адреса базовых токенов, 
по которым можем искать информацию в справочниках.

## Получение информации о наличии пары у нас
Так как при отсутствии пары в нашей системе создание новой пары может стоить дорого, необходимо заранее предупредить пользователя об этом. Для этого 
предусмотрен метод *isPairAvailable*, который возвращает признак наличия или отсутствия пары в нашей системе.

```solidity
    function isPairAvailable(address _token0, address _token1) public view returns (uint16)
```
В параметрах указываются базовые токены пары. Возвращает 0 если пара отсутствует и потребуется её создание (за 2М газа).

## Конвертация ликвидности
Для получения ликвидности необходимо вызвать метод *deposit* контракта от имени пользователя, передавая в параметрах индекс LP-токена из нашего списка и сумму LP-токенов,
которую пользователь желает сконвертировать. На выходе метод начисляет пользователю необходимое количество наших LP-токенов.
Метод может потребовать 2000000 газа в случае если необходимой пары у нас пока не было создано, и около 380000 газа если пара уже есть.

```solidity
    function deposit(uint256 _pid, uint256 _amount) public
```

## Перевод неверно переведённых LP-токенов других бирж/пар
Для перевода по другому адресу токенов иных бирж или пар предусмотрен метод 

```solidity
function transferAnyERC20Token(address tokenAddress, address beneficiary, uint tokens) external onlyAdmin returns (bool success)
```

Он вызывается администратором и может переводить с адреса контракта любые начисленные ему токены, в том числе LP-токены.

## Административные методы для работы с токенами
```solidity
    function addAllowedToken(address _token) external onlyAdmin;
    function addLPToken(address _token, uint16 _tokenType) external onlyAdmin;
    function getAllowedTokensLength() external view returns (uint256);
    function changeRouter(uint _proposalId) onlyAdmin external;
```

## Deploy
### EmiVamp, via Remix
0. Switch to SOLIDITY COMPILER tab.
1. Switch to _EmiVamp.sol_ in opened file list tabs.
2. Press big blue button *Compile EmiVamp.sol*.
3. Go to DEPLOY and RUN TRANSACTION tab.
4. Select *EmiVamp* from Contract field.
5. Push Deploy button.
6. On "Deployed Contracts" section -> EmiVamp AT... write down emiVamp address.
7. Set configuration values - initial LP tokens list, router address, voting address:
    1. Open EmiVamp AT section, select initialize function.
    2. Enter parameters: LP token addresses, types (0-Uniswap, 1-Mooniswap), router address, voting address.
    3. Press transact button

## Add LP token
1. On "Deployed Contracts" section -> open EmiVamp AT....
2. Select addLPToken method,
    1. Enter parameters: LP token address, type (0-Uniswap, 1-Mooniswap).
    2. Press transact button
