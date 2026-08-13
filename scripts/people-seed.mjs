/**
 * Исходный список персон для модуля «Известные люди» (Казахстан, V1).
 *
 * Это НЕ итоговая база, а вход для проверки: каждое имя резолвится в Wikidata
 * (scripts/people-fetch.mjs), оттуда берутся годы жизни, род занятий и ссылка
 * на фото, а лицензия фото — из Wikimedia Commons. Ничего не пишется по
 * памяти: если запись не подтвердилась, она не попадает в базу.
 *
 * Дубликаты убираются по идентификатору Wikidata, а не по написанию: в
 * присланном списке один человек встречается под русским и казахским именем
 * («Мухтар Ауэзов» и «Мұхтар Әуезов»), по строкам их не свести.
 *
 * Формат строки: `Имя | категория | подсказка для поиска (необязательно)`.
 * Подсказка — латиницей, потому что в Wikidata часть казахстанских персон
 * заведена только с английской меткой.
 */
export const SEED = String.raw`
# история, ханы, батыры, бии
Керей хан | history | Kerei Khan
Жәнібек хан | history | Janybek Khan
Қасым хан | history | Kasym Khan
Хақназар хан | history | Haknazar Khan
Шығай хан | history | Shigay Khan
Тәуекел хан | history | Tauekel Khan
Есім хан | history | Yesim Khan
Жәңгір хан | history | Jangir Khan
Тәуке хан | history | Tauke Khan
Әбілқайыр хан | history | Abul Khair Khan of the Kazakhs
Абылай хан | history | Ablai Khan
Кенесары Қасымұлы | history | Kenesary Kasymov
Наурызбай Қасымұлы | history | Nauryzbai Kasymov
Қабанбай батыр | history | Kabanbai Batyr
Бөгенбай батыр | history | Bogenbai Batyr
Райымбек батыр | history | Raiymbek Batyr
Қарасай батыр | history | Karasai Batyr
Бұқар жырау | history | Bukhar Zhyrau
Ақтамберді жырау | history | Aktamberdy Zhyrau
Үмбетей жырау | history | Umbetei Zhyrau
Махамбет Өтемісұлы | history | Makhambet Utemisuly
Исатай Тайманұлы | history | Isatay Taimanov
Сырым Датұлы | history | Syrym Datuly
Бөкей хан | history | Bukey Khan
Жәңгір Бөкейұлы | history | Jangir Khan of Bukey Horde
Олжабай батыр | history | Olzhabai Batyr
Малайсары батыр | history | Malaisary Batyr
Жалаңтөс Баһадүр | history | Zhalantos Bahadur
Қазыбек би | history | Kazybek bi
Төле би | history | Tole bi
Әйтеке би | history | Aiteke bi
Сүйінбай Аронұлы | history | Suyunbai Aronuly

# Алаш и национальная интеллигенция
Әлихан Бөкейхан | alash | Alikhan Bukeikhanov
Ахмет Байтұрсынұлы | alash | Akhmet Baitursynov
Міржақып Дулатұлы | alash | Mirjaqip Dulatuli
Жаһанша Досмұхамедов | alash | Jahansha Dosmukhamedov
Халел Досмұхамедұлы | alash | Khalel Dosmukhamedov
Мұхамеджан Тынышбаев | alash | Mukhamedzhan Tynyshpayev
Мағжан Жұмабаев | alash | Magzhan Zhumabayev
Жүсіпбек Аймауытов | alash | Zhusipbek Aimauytov
Халел Ғаббасов | alash | Khalel Gabbasov
Мұхамеджан Сералин | alash | Mukhamedzhan Seralin
Мұстафа Шоқай | alash | Mustafa Shokay
Смағұл Сәдуақасов | alash | Smagul Saduakasov
Тұрар Рысқұлов | alash | Turar Ryskulov
Сәкен Сейфуллин | alash | Saken Seifullin
Бейімбет Майлин | alash | Beimbet Mailin
Ілияс Жансүгіров | alash | Ilyas Zhansugurov
Темірбек Жүргенов | alash | Temirbek Zhurgenov
Санжар Асфендияров | alash | Sanzhar Asfendiyarov
Ораз Жандосов | alash | Oraz Zhandosov
Нығмет Нұрмақов | alash | Nygmet Nurmakov
Жақып Ақбаев | alash | Zhakyp Akbayev
Әлімхан Ермеков | alash | Alimkhan Yermekov
Елдес Омарұлы | alash | Yeldes Omaruly
Телжан Шонанұлы | alash | Telzhan Shonanuly
Қошке Кемеңгерұлы | alash | Koshke Kemengeruly
Сәбит Дөнентаев | alash | Sabit Donentayev
Әліби Жангелдин | alash | Alibi Dzhangildin
Сұлтанбек Қожанов | alash | Sultanbek Khodzhanov
Ахмет Бірімжанов | alash | Akhmet Birimzhanov

# литература и поэзия
Абай Құнанбайұлы | literature | Abai Qunanbaiuly
Шәкәрім Құдайбердіұлы | literature | Shakarim Qudaiberdiuly
Мұхтар Әуезов | literature | Mukhtar Auezov
Сұлтанмахмұт Торайғыров | literature | Sultanmakhmut Toraigyrov
Спандияр Көбеев | literature | Spandiyar Kobeyev
Сәбит Мұқанов | literature | Sabit Mukanov
Ғабит Мүсірепов | literature | Gabit Musrepov
Ғабиден Мұстафин | literature | Gabiden Mustafin
Мұқағали Мақатаев | literature | Mukagali Makatayev
Жұмекен Нәжімеденов | literature | Zhumeken Nazhimedenov
Қадыр Мырза Әли | literature | Kadyr Myrza Ali
Тұманбай Молдағалиев | literature | Tumanbai Moldagaliyev
Фариза Оңғарсынова | literature | Fariza Ongarsynova
Ақұштап Бақтыгереева | literature | Akushtap Baktygereyeva
Олжас Сүлейменов | literature | Olzhas Suleimenov
Мұхтар Шаханов | literature | Mukhtar Shakhanov
Әбдіжәміл Нұрпейісов | literature | Abdizhamil Nurpeisov
Әзілхан Нұршайықов | literature | Azilkhan Nurshaikhov
Дулат Исабеков | literature | Dulat Isabekov
Смағұл Елубай | literature | Smagul Yelubai
Қабдеш Жұмаділов | literature | Kabdesh Zhumadilov
Сафуан Шаймерденов | literature | Safuan Shaimerdenov
Оралхан Бөкей | literature | Oralkhan Bokeyev
Шерхан Мұртаза | literature | Sherkhan Murtaza
Сайын Мұратбеков | literature | Sayin Muratbekov
Төлен Әбдіков | literature | Tolen Abdikov
Әкім Тарази | literature | Akim Tarazi
Қалихан Ысқақ | literature | Kalikhan Iskakov
Қуандық Шаңғытбаев | literature | Kuandyk Shangytbayev
Мұзафар Әлімбаев | literature | Muzafar Alimbayev
Несіпбек Айтұлы | literature | Nesipbek Aituly
Есенғали Раушанов | literature | Yesengali Raushanov
Ілияс Есенберлин | literature | Ilyas Yesenberlin
Бауыржан Момышұлы | literature | Bauyrzhan Momyshuly
Жамбыл Жабаев | literature | Jambyl Jabayev
Тахауи Ахтанов | literature | Takhaui Akhtanov
Хамит Ерғалиев | literature | Khamit Yergaliyev
Сырбай Мәуленов | literature | Syrbai Maulenov
Ғафу Қайырбеков | literature | Gafu Kairbekov
Асқар Сүлейменов | literature | Askar Suleimenov

# наука, медицина, образование
Шоқан Уәлиханов | science | Chokan Valikhanov
Ыбырай Алтынсарин | science | Ibrai Altynsarin
Қаныш Сәтбаев | science | Kanysh Satpayev
Әлкей Марғұлан | science | Alkey Margulan
Евней Бөкетов | science | Yevney Buketov
Мұрат Айтхожин | science | Murat Aitkhozhin
Ермұхан Бекмаханов | science | Yermukhan Bekmakhanov
Манаш Қозыбаев | science | Manash Kozybayev
Төрегелді Шарманов | science | Toregeldy Sharmanov
Шәпік Шокин | science | Shafik Chokin
Өмірзақ Сұлтанғазин | science | Umirzak Sultangazin
Шахмардан Есенов | science | Shakhmardan Yessenov
Мұхтар Жәкішев | science | Mukhtar Dzhakishev
Асқар Жұмаділдаев | science | Askar Dzhumadildayev
Мұрат Жұрынов | science | Murat Zhurinov
Мұрат Әуезов | science | Murat Auezov
Ахмет Жұбанов | science | Akhmet Zhubanov
Құдайберген Жұбанов | science | Kudaibergen Zhubanov
Әбдуәли Қайдар | science | Abduali Kaidar
Рәбиға Сыздықова | science | Rabiga Syzdykova
Зейнолла Қабдолов | science | Zeinolla Kabdolov
Салық Зиманов | science | Salyk Zimanov
Нығмет Сауранбаев | science | Nygmet Sauranbayev
Ахмет Машанов | science | Akhmet Mashanov
Әбікен Бектұров | science | Abiken Bekturov
Асқар Құнаев | science | Askar Kunayev
Сұлтан Сартаев | science | Sultan Sartayev
Кемел Ақышев | science | Kemal Akishev
Әбдімәлік Нысанбаев | science | Abdimalik Nysanbayev
Дінмұхамед Қонаев | science | Dinmukhamed Kunaev

# музыка и сцена
Күләш Байсейітова | music | Kulyash Baiseitova
Роза Бағланова | music | Roza Baglanova
Бибігүл Төлегенова | music | Bibigul Tulegenova
Роза Рымбаева | music | Roza Rymbayeva
Нұрғиса Тілендиев | music | Nurgisa Tlendiyev
Шәмші Қалдаяқов | music | Shamshi Kaldayakov
Мұқан Төлебаев | music | Mukan Tulebayev
Латиф Хамиди | music | Latif Khamidi
Манарбек Ержанов | music | Manarbek Yerzhanov
Кенен Әзірбаев | music | Kenen Azerbayev
Әміре Қашаубаев | music | Amre Kashaubayev
Дина Нұрпейісова | music | Dina Nurpeisova
Майра Уәлиқызы | music | Maira Shamsutdinova
Құрманғазы Сағырбайұлы | music | Kurmangazy Sagyrbaiuly
Дәулеткерей Шығайұлы | music | Dauletkerey Shygayuly
Тәттімбет Қазанғапұлы | music | Tattimbet Kazangapuly
Біржан сал | music | Birzhan sal
Ақан сері | music | Akan seri
Ықылас Дүкенұлы | music | Ykylas Dukenuly
Жаяу Мұса Байжанұлы | music | Zhayau Musa Baizhanuly
Естай Беркімбайұлы | music | Estai Berkimbayuly
Мәди Бәпиұлы | music | Madi Bapiuly
Ермек Серкебаев | music | Yermek Serkebayev
Әлібек Дінішев | music | Alibek Dnishev
Батырхан Шүкенов | music | Batyrkhan Shukenov
Димаш Құдайберген | music | Dimash Qudaibergen
Роза Жаманова | music | Roza Zhamanova
Жәнібек Кәрменов | music | Zhanibek Karmenov
Қайрат Байбосынов | music | Kairat Baibosynov
Нұрлан Өнербаев | music | Nurlan Onerbayev

# кино, театр, изобразительное искусство
Әбілхан Қастеев | art | Abylkhan Kasteyev
Шәкен Айманов | art | Shaken Aimanov
Асанәлі Әшімов | art | Asanali Ashimov
Қанапия Тельжанов | art | Kanafia Telzhanov
Салихитдин Айтбаев | art | Salikhitdin Aitbayev
Гүлфайрус Ысмайылова | art | Gulfairus Ismailova
Молдахмет Кенбаев | art | Moldakhmet Kenbayev
Рашид Нұғманов | art | Rashid Nugmanov
Ермек Тұрсынов | art | Yermek Tursunov
Нариман Төребаев | art | Nariman Turebayev
Әділхан Ержанов | art | Adilkhan Yerzhanov
Сергей Дворцевой | art | Sergei Dvortsevoy
Самал Есләмова | art | Samal Yeslyamova
Қалибек Қуанышбаев | art | Kalibek Kuanyshbayev
Серке Қожамқұлов | art | Serke Kozhamkulov
Елубай Өмірзақов | art | Yelubai Umurzakov
Хадиша Бөкеева | art | Khadisha Bukeyeva
Фарида Шәріпова | art | Farida Sharipova
Нұрмұхан Жантөрин | art | Nurmukhan Zhanturin
Сәбира Майқанова | art | Sabira Maikanova
Мәжит Бегалин | art | Mazhit Begalin
Сұлтан Қожықов | art | Sultan Khodzhikov
Абдулла Қарсақбаев | art | Abdulla Karsakbayev
Виктор Цой | art | Viktor Tsoi
Сергей Калмыков | art | Sergey Kalmykov
Евгений Сидоркин | art | Yevgeny Sidorkin
Тимур Бекмамбетов | art | Timur Bekmambetov
Ұлжан Байбосынова | art | Ulzhan Baibosynova
Меруерт Өтекешова | art | Meruert Utekesheva
Тұңғышбай Жаманқұлов | art | Tungyshbai Zhamankulov

# спорт
Геннадий Головкин | sport | Gennadiy Golovkin
Серік Сәпиев | sport | Serik Sapiyev
Бақтияр Артаев | sport | Bakhtiyar Artayev
Бекзат Саттарханов | sport | Bekzat Sattarkhanov
Илья Ильин | sport | Ilya Ilyin
Александр Винокуров | sport | Alexander Vinokourov
Ольга Рыпакова | sport | Olga Rypakova
Елена Рыбакина | sport | Elena Rybakina
Жансая Әбдімәлік | sport | Zhansaya Abdumalik
Динара Садуақасова | sport | Dinara Saduakassova
Дмитрий Карпов | sport | Dmitriy Karpov
Елдос Сметов | sport | Yeldos Smetov
Назым Кызайбай | sport | Nazym Kyzaibay
Светлана Подобедова | sport | Svetlana Podobedova
Зульфия Чиншанло | sport | Zulfiya Chinshanlo
Майя Манеза | sport | Maiya Maneza
Денис Тен | sport | Denis Ten
Михаил Кукушкин | sport | Mikhail Kukushkin
Юлия Путинцева | sport | Yulia Putintseva
Александр Бублик | sport | Alexander Bublik
Андрей Голубев | sport | Andrey Golubev
Қанат Ислам | sport | Kanat Islam
Бейбіт Шүменов | sport | Beibut Shumenov
Василий Жиров | sport | Vassiliy Jirov
Жақсылық Үшкемпіров | sport | Zhaksylyk Ushkempirov
Дәулет Тұрлыханов | sport | Daulet Turlykhanov
Бақыт Сәрсекбаев | sport | Bakhyt Sarsekbayev
Ермахан Ибраимов | sport | Yermakhan Ibraimov
Василий Левит | sport | Vassiliy Levit
Иван Дычко | sport | Ivan Dychko
Данияр Елеусінов | sport | Daniyar Yeleussinov
Владимир Смирнов | sport | Vladimir Smirnov skier
Ольга Шишигина | sport | Olga Shishigina
Александр Парыгин | sport | Alexandr Parygin
Серік Қонақбаев | sport | Serik Konakbayev
Юрий Мельниченко | sport | Yuriy Melnichenko
Әділбек Ниязымбетов | sport | Adilbek Niyazymbetov
Нұрлан Балғымбаев | sport | Nurlan Balgimbayev
Мұхтархан Дилдабеков | sport | Mukhtarkhan Dildabekov
Дмитрий Баландин | sport | Dmitriy Balandin
Ольга Рыпакова | sport | Olga Rypakova
Нұрсұлтан Тұрсынбай | sport | Nursultan Tursynbay
Валерий Тихоненко | sport | Valeri Tikhonenko
Юрий Захаревич | sport | Yuri Zakharevich

# космос, авиация, инженерия
Тоқтар Әубәкіров | space | Toktar Aubakirov
Талғат Мұсабаев | space | Talgat Musabayev
Айдын Айымбетов | space | Aidyn Aimbetov
Владимир Шаталов | space | Vladimir Shatalov
Виктор Пацаев | space | Viktor Patsayev
Юрий Лончаков | space | Yuri Lonchakov
Александр Викторенко | space | Alexander Viktorenko
Юрий Маленченко | space | Yuri Malenchenko
Талғат Бигелдинов | space | Talgat Bigeldinov
Нұркен Әбдіров | space | Nurken Abdirov
Сергей Луганский | space | Sergei Luganskii
Леонид Беда | space | Leonid Beda
Хиуаз Доспанова | space | Khiuaz Dospanova
Рахымжан Қошқарбаев | space | Rakhimzhan Koshkarbayev
Мәншүк Мәметова | space | Manshuk Mametova
Әлия Молдағұлова | space | Aliya Moldagulova
`;

/** Разбирает список в массив записей. */
export function parseSeed() {
  return SEED.split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const [name, category, hint] = line.split('|').map((part) => part.trim());
      return { name, category, hint: hint || name };
    });
}
