# ERC1155 (NFT) tokens implementation

## Введение

Ниже изложена инструкция по работе с токенами формата NFT (ERC1155), предназначенная для разработчиков самих токенов, разработчиков backend/frontend/oracle.
Сам по себе стандарт ERC1155 описан в [соответствующем документе](https://eips.ethereum.org/EIPS/eip-1155), и для целей быстрой разработки используется его
имплементация в виде библиотеки OpenZeppelin. Основные принципы:
 1. Каждый NFT токен имеет уникальный идентификатор ID. Он уникален в системе и может быть только в единственном числе. Идентификатор состоит из 256 бит (64 hex цифры без префикса 0x).
 2. Идентификатор токена состоит из 2 частей, CardType и CardId, каждая из которых имеет длину 128 бит. Для получения полного идентификатора необходимо соединить вместе 32 hex цифры CardType с 32 цифрами CardId.
 3. Описание каждого токена состоит из JSON-файла определённого формата. Конкретные свойства каждого токена могут гибко настраиваться.
 4. Перед использованием токен должны быть создан (mint). При создании токена указывается адрес владельца и ID токена.
 5. Владелец токена может его сжечь, (уничтожить, burn). Сожжёный токен может быть создан снова.
 6. Полный перечень всех токенов разных типов владельца можно получить только через oracle, который ведет свою собственную БД, пополняемую из событий (events).
   Контракт ERC1155 не ведёт списков токенов по владельцу, только список владельцев определённых токенов.

## Идентификаторы токенов
Ниже перечислены типы карт (токенов), используемых в системе.

| CardType | Название |
|---|---|
| 1        | Коллекционная карта (collectible card) |
| 2        | Дополнительная карта (add-on card) |
| 3        | Карта специального действия (special action card) |


Соответственно, полные идентификаторы карт могут быть такими:
 - 000000000000000000000000000000100000000000000000000000000000024e: коллекционная карта с CardID 590/0x24e
 - 0000000000000000000000000000002000000000000000000000000000000011: дополнительная карта с CardID 17/0x11
 - 0000000000000000000000000000003000000000000000000000000000fd0583: карта специального действия с CardID 16582019/0xfd0583

Распределение конкретных характеристик карт в зависимости от CardID остаётся за разработчиками backend.

## Описание свойств карт
Все детальные свойства карт описываются в JSON-файле опредленного формата:
```json
{
	"name": "Asset Name",
	"description": "Lorem ipsum...",
	"image": "https:\/\/s3.amazonaws.com\/your-bucket\/images\/{id}.png",
	"properties": {
		"simple_property": "example value",
		"rich_property": {
			"name": "Name",
			"value": "123",
			"display_value": "123 Example Value",
			"class": "emphasis",
			"css": {
				"color": "#ffffff",
				"font-weight": "bold",
				"text-decoration": "underline"
			}
		},
		"array_property": {
			"name": "Name",
			"value": [1,2,3,4],
			"class": "emphasis"
		}
	}
}
```
Свойства *name*, *description*, *image* являются обязательными, свойство *properties* -- произвольным, структура может быть любой и остаётся на усмотрение разработчиков.

Смартконтракт ERC1155 содержит в себе адрес URI, по которому можно получить файлы описаний токенов. Вызвав метод _ERC1155.uri(id)_ смартконтракта можно получить
URI файлов описаний в виде: *https://token-cdn-domain/{id}.json*, где значение строки {id} должно быть заменено клиентом на актуальный идентификатор клиента.

## Описание дополнительных свойств карт

Ниже приведен список дополнительных свойств карт, предлагаемых для использования в NFT Magic Cards

| Название свойства | Тип данных | Допустимые значения | Описание | Комментарии |
| ---- | ---- | ---- | ---- | ---- |
| power | int  | 1-100 | Сила карты | Для боевых карт |  |
| kind | string  | [light,dark] | Светлость карты | Для боевых карт |  |
| opened | bool | [true,false] | Открытость карты | true для открытой карты |  |
| swap_bonus | decimal | [0..100] | Процент бонуса на swap | |
| lp_bonus | decimal | [0..100] | Процент бонуса на размещение ликвидности |  |


## События, генерируемые смартконтрактом

Смартконтракт в течении жизни генерирует следющие события, по которым следует отслеживать состояние токенов в oracle.
```solidity
    /**
     * @dev Emitted when `value` tokens of token type `id` are transferred from `from` to `to` by `operator`.
     */
    event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);

    /**
     * @dev Equivalent to multiple {TransferSingle} events, where `operator`, `from` and `to` are the same for all
     * transfers.
     */
    event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values);

    /**
     * @dev Emitted when `account` grants or revokes permission to `operator` to transfer their tokens, according to
     * `approved`.
     */
    event ApprovalForAll(address indexed account, address indexed operator, bool approved);

    /**
     * @dev Emitted when the URI for token type `id` changes to `value`, if it is a non-programmatic URI.
     *
     * If an {URI} event was emitted for `id`, the standard
     * https://eips.ethereum.org/EIPS/eip-1155#metadata-extensions[guarantees] that `value` will equal the value
     * returned by {IERC1155MetadataURI-uri}.
     */
    event URI(string value, uint256 indexed id);
```
При создании токена генерируется событие TransferSingle с адресом 0x0 в качестве источника. 
При сжигании токена генерируется событие TransferSingle с адресом 0x0 в качестве назначения.

## Папка для хранения изображений карт на IPFS

https://ipfs.io/ipfs/QmZ8XwcNhLfTcj7iLcb4UDLWenVe85H2c8L7wcxso5w1Jj/
