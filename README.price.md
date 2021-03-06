# EmiPrice2 contract README

Контракт предназначен для получения информации о ценах токенов на биржах Emiswap, Uniswap, 1inch одним массивом. Контракт обладает возможностью искать путь
до искомого токена по всем доступным на бирже парам токенов.

## Методы контракта

### getCoinPrices
Метод принимает на вход список адресов токенов, для которых необходимо получить цену и индекс-указатель на биржу, с которой необходимо получать эти цены.
Метод возвращает массив цен указанных токенов с точностью 18 знаков после запятой. Если цену для какого-то токена определить не удалось, в соответствующей позиции возвращается 0.
Метод использует список базовых токенов для определения цены надёжнее.

Значения параметра _market:
 - 0: наша собственная биржа
 - 1: биржа Uniswap
 - 2: биржа Mooniswap


```solidity
  function getCoinPrices(address [] calldata _coins, address [] calldata _basictokens, uint8 _market) external view returns(uint[] memory prices)
```

*Алгоритм работы*

  Метод реализует следующий алгоритм работы для получения цен на токены:
1. По каждому токену и первому базовому токену пытается найти прямую пару в фабрике EmiFactory, если находит -- то получает курс от нее и переходит к следующему токену.
2. Если прямая пара не находится, пытается найти маршрут через кросс-курсы всех имеющихся в EmiFactory пар.
3. Если маршрут не находится, берет следующий базовый токен и повторяет последовательность действий с п. 1

  Для поиска маршрута используется адаптированный [алгоритм Ли](https://ru.wikipedia.org/wiki/%D0%90%D0%BB%D0%B3%D0%BE%D1%80%D0%B8%D1%82%D0%BC_%D0%9B%D0%B8), 
имеющий вычислительную сложность o(n).

### calcRoute
Метод принимает на вход адреса токенов, между которыми надо найти путь через кросс-пары. Метод возвращает массив-список токенов, составляющих путь от одного токена
к другому. Массив можно непосредственно отдать в метод EmiRouter.getAmountsOut для получения расчетов курса.


```solidity
  function calcRoute(address _target, address _base) external view returns (address[] memory path)
```
