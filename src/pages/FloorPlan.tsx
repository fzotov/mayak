// План этажей: подложка-чертёж и кликабельные кабинеты; свободные подсвечены, справа — карточка выбранного кабинета.
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Page, Card, Row, Button, Badge, Segmented, ErrorBox, Muted, money, dateRu, C } from '../components/ui'

// Exact SVG paths derived from pixel-accurate room fills in the source floor-plan images.
// Floor 2 viewBox: 0 0 2048 1150 | Floor 3 viewBox: 0 0 1984 1296
// Source: floorplans_hitareas_EXACT.json

type RoomData = {
  id: string
  number: string
  area_m2: number | null
  combined_area_m2?: number | null
  svg_path: string
  status: 'available' | 'occupied'
  serviceLabel?: string  // for non-rentable internal rooms
}

const ROOMS_F2: RoomData[] = [
  { id:'201-202', number:'201, 202', area_m2:38.3,  status:'occupied',  svg_path:'M 289 38 L 289 292 L 319 292 L 320 252 L 336 252 L 348 257 L 351 261 L 354 261 L 369 278 L 374 292 L 404 292 L 404 38 Z M 92 38 L 92 286 L 162 286 L 164 288 L 164 292 L 276 292 L 276 200 L 269 200 L 260 197 L 247 188 L 236 187 L 238 177 L 234 173 L 229 162 L 229 146 L 226 140 L 226 130 L 230 122 L 236 122 L 241 127 L 240 144 L 242 144 L 251 130 L 249 127 L 246 132 L 242 132 L 242 126 L 246 122 L 252 122 L 256 126 L 256 134 L 250 142 L 256 142 L 257 144 L 276 144 L 276 38 L 237 38 L 236 41 L 119 41 L 117 38 Z' },
  { id:'203',     number:'203',      area_m2:24.1,  status:'occupied',  svg_path:'M 416 38 L 416 292 L 476 292 L 477 252 L 493 252 L 504 257 L 508 261 L 511 261 L 522 272 L 522 275 L 526 279 L 531 292 L 584 292 L 584 41 L 533 41 L 532 38 L 513 38 L 512 41 L 423 41 L 422 38 Z' },
  { id:'204',     number:'204',      area_m2:21.6,  status:'occupied',  svg_path:'M 596 41 L 596 292 L 641 292 L 641 254 L 643 252 L 659 252 L 670 257 L 674 261 L 677 261 L 692 279 L 697 292 L 769 292 L 769 38 L 762 38 L 761 41 L 672 41 L 671 38 L 652 38 L 651 41 Z' },
  { id:'205',     number:'205',      area_m2:19.7,  status:'occupied',  svg_path:'M 780 38 L 780 292 L 821 292 L 822 252 L 839 252 L 856 261 L 871 278 L 876 292 L 926 292 L 926 38 L 899 38 L 897 41 L 809 41 L 808 38 Z' },
  { id:'206',     number:'206',      area_m2:24.1,  status:'occupied',  svg_path:'M 937 38 L 937 292 L 998 292 L 999 252 L 1015 252 L 1033 261 L 1049 279 L 1051 288 L 1054 292 L 1101 292 L 1101 41 L 1058 41 L 1057 38 L 1038 38 L 1036 41 L 948 41 L 947 38 Z' },
  { id:'207',     number:'207',      area_m2:26.2,  status:'occupied',  svg_path:'M 1114 41 L 1114 292 L 1182 292 L 1183 252 L 1199 252 L 1217 261 L 1232 278 L 1237 292 L 1292 292 L 1292 38 L 1287 38 L 1285 41 L 1197 41 L 1195 38 L 1177 38 L 1175 41 Z' },
  { id:'208',     number:'208',      area_m2:21.82, status:'occupied',  svg_path:'M 1305 38 L 1305 292 L 1352 292 L 1353 252 L 1370 252 L 1387 261 L 1401 276 L 1408 292 L 1469 292 L 1469 41 L 1430 41 L 1428 38 L 1410 38 L 1409 41 L 1320 41 L 1319 38 Z' },
  { id:'209',     number:'209',      area_m2:25.15, status:'occupied',  svg_path:'M 1482 41 L 1482 292 L 1556 292 L 1556 254 L 1558 252 L 1574 252 L 1585 257 L 1589 261 L 1592 261 L 1607 278 L 1607 282 L 1609 283 L 1609 287 L 1612 292 L 1680 292 L 1680 38 L 1659 38 L 1657 41 L 1569 41 L 1568 38 L 1549 38 L 1548 41 Z' },
  { id:'224',     number:'224',      area_m2:21.2,  status:'occupied',  svg_path:'M 164 388 L 164 409 L 168 410 L 168 505 L 164 507 L 164 530 L 402 530 L 402 507 L 388 502 L 376 493 L 370 486 L 362 470 L 363 451 L 402 451 L 402 388 Z' },
  { id:'223',     number:'223',      area_m2:23.1,  status:'occupied',  svg_path:'M 164 543 L 164 566 L 168 567 L 168 662 L 164 664 L 164 685 L 402 685 L 402 628 L 393 628 L 384 621 L 381 621 L 371 611 L 362 593 L 363 575 L 402 575 L 402 543 Z' },
  { id:'226',     number:'226',      area_m2:14.4,  status:'occupied',  svg_path:'M 508 388 L 508 530 L 671 530 L 671 388 L 627 388 L 625 399 L 616 414 L 611 417 L 615 423 L 615 427 L 608 438 L 614 438 L 614 443 L 600 442 L 601 437 L 609 426 L 607 423 L 604 428 L 599 426 L 592 438 L 599 438 L 599 443 L 584 442 L 584 439 L 592 428 L 588 431 L 575 431 L 575 437 L 565 436 L 565 421 L 568 418 L 572 418 L 572 388 Z' },
  { id:'227',     number:'227',      area_m2:10.2,  status:'occupied',  svg_path:'M 683 388 L 683 530 L 785 530 L 785 388 L 757 388 L 757 394 L 748 411 L 738 421 L 727 428 L 720 430 L 718 444 L 710 444 L 709 435 L 708 450 L 704 450 L 702 448 L 699 439 L 699 449 L 694 449 L 695 425 L 699 426 L 703 436 L 702 388 Z' },
  { id:'228',     number:'228',      area_m2:10.1,  status:'occupied',  serviceLabel:'Кухня (служебное)', svg_path:'M 796 388 L 796 530 L 908 530 L 908 388 L 876 388 L 876 394 L 871 404 L 867 408 L 867 411 L 857 421 L 839 430 L 837 444 L 829 444 L 828 435 L 827 450 L 823 450 L 821 448 L 818 439 L 818 449 L 813 449 L 814 425 L 818 426 L 822 436 L 821 388 Z' },
  { id:'229',     number:'229',      area_m2:21.3,  status:'occupied',  svg_path:'M 921 388 L 921 530 L 1164 530 L 1164 388 L 1138 388 L 1136 398 L 1129 409 L 1119 419 L 1102 428 L 1084 427 L 1084 388 Z' },
  { id:'230',     number:'230',      area_m2:44.85, status:'occupied',  svg_path:'M 1177 388 L 1177 530 L 1682 530 L 1682 388 L 1264 388 L 1262 397 L 1255 406 L 1255 409 L 1245 419 L 1227 428 L 1209 427 L 1209 388 Z' },
  { id:'231',     number:'231',      area_m2:12.5,  status:'available', svg_path:'M 508 542 L 508 685 L 572 685 L 571 642 L 578 641 L 580 645 L 581 642 L 580 639 L 575 640 L 572 638 L 572 624 L 588 624 L 588 629 L 580 630 L 580 632 L 587 634 L 588 645 L 590 645 L 589 630 L 594 623 L 598 622 L 603 624 L 607 631 L 607 644 L 601 651 L 607 654 L 618 665 L 625 677 L 627 685 L 671 685 L 671 542 Z' },
  { id:'231A',    number:'231A',     area_m2:10.2,  status:'occupied',  svg_path:'M 683 543 L 683 684 L 702 685 L 702 649 L 698 643 L 699 631 L 703 627 L 710 628 L 712 631 L 712 645 L 714 643 L 718 643 L 719 645 L 726 634 L 724 636 L 719 636 L 719 631 L 723 627 L 729 627 L 732 630 L 733 635 L 728 643 L 732 643 L 733 648 L 728 649 L 734 651 L 748 664 L 755 676 L 757 685 L 785 685 L 785 543 Z' },
  { id:'231B',    number:'231Б',     area_m2:10.3,  status:'occupied',  svg_path:'M 796 543 L 796 685 L 821 685 L 821 649 L 817 643 L 817 634 L 822 627 L 827 627 L 831 631 L 831 645 L 833 643 L 836 643 L 837 645 L 838 641 L 843 641 L 844 643 L 844 641 L 841 640 L 841 636 L 844 635 L 844 633 L 843 635 L 839 635 L 837 633 L 841 627 L 847 627 L 851 631 L 851 641 L 852 630 L 856 627 L 861 627 L 865 633 L 864 646 L 858 650 L 851 644 L 847 649 L 853 651 L 867 664 L 867 667 L 871 670 L 876 685 L 908 685 L 908 543 Z' },
  { id:'232',     number:'232',      area_m2:16.6,  status:'available', svg_path:'M 921 542 L 921 685 L 980 685 L 980 646 L 989 645 L 989 633 L 992 627 L 997 623 L 1004 624 L 1004 629 L 998 632 L 1003 632 L 1006 635 L 1007 645 L 1005 648 L 1022 660 L 1033 677 L 1035 685 L 1097 685 L 1097 542 Z' },
  { id:'232A',    number:'232A',     area_m2:16.87, status:'occupied',  svg_path:'M 1110 543 L 1110 685 L 1168 685 L 1168 657 L 1166 656 L 1168 646 L 1176 645 L 1176 640 L 1178 637 L 1176 629 L 1181 623 L 1185 622 L 1189 623 L 1193 628 L 1192 638 L 1194 642 L 1194 649 L 1196 649 L 1203 633 L 1203 630 L 1195 630 L 1194 624 L 1212 624 L 1212 629 L 1207 644 L 1203 651 L 1199 651 L 1207 656 L 1215 665 L 1222 677 L 1224 685 L 1283 685 L 1283 543 Z' },
  { id:'233',     number:'233',      area_m2:13.9,  status:'occupied',  svg_path:'M 1295 543 L 1295 685 L 1325 685 L 1325 651 L 1321 648 L 1321 642 L 1327 641 L 1329 645 L 1330 644 L 1329 641 L 1325 640 L 1325 634 L 1329 633 L 1330 631 L 1329 630 L 1327 633 L 1322 633 L 1321 627 L 1325 623 L 1329 622 L 1337 626 L 1338 633 L 1336 637 L 1338 640 L 1338 645 L 1346 645 L 1351 649 L 1351 646 L 1356 643 L 1353 643 L 1348 639 L 1348 628 L 1356 622 L 1360 623 L 1364 627 L 1364 645 L 1360 650 L 1356 651 L 1364 656 L 1374 668 L 1381 685 L 1440 684 L 1440 543 Z' },
  { id:'234',     number:'234',      area_m2:12.2,  status:'occupied',  svg_path:'M 1451 543 L 1451 685 L 1480 685 L 1480 646 L 1485 645 L 1485 643 L 1470 642 L 1470 639 L 1478 629 L 1478 626 L 1476 630 L 1472 630 L 1470 628 L 1470 624 L 1475 620 L 1481 620 L 1485 624 L 1485 630 L 1480 637 L 1491 637 L 1491 645 L 1505 647 L 1521 658 L 1533 675 L 1536 685 L 1566 684 L 1566 543 Z' },
  { id:'221',     number:'221',      area_m2:25.0,  status:'occupied',  svg_path:'M 415 798 L 415 1041 L 584 1041 L 584 798 L 531 798 L 531 803 L 526 814 L 522 818 L 522 821 L 511 832 L 508 832 L 498 839 L 483 841 L 476 840 L 476 798 Z' },
  { id:'220',     number:'220',      area_m2:23.1,  status:'occupied',  svg_path:'M 596 798 L 596 1041 L 769 1041 L 769 798 L 697 798 L 697 803 L 692 811 L 692 814 L 680 829 L 664 839 L 643 841 L 641 839 L 641 798 Z' },
  { id:'219',     number:'219',      area_m2:18.1,  status:'occupied',  svg_path:'M 780 798 L 780 1041 L 926 1041 L 926 798 L 876 798 L 876 803 L 871 815 L 857 831 L 844 839 L 823 841 L 821 839 L 821 798 Z' },
  { id:'218',     number:'218',      area_m2:23.56, status:'occupied',  svg_path:'M 937 798 L 937 1041 L 1115 1041 L 1115 798 L 1051 798 L 1049 810 L 1042 818 L 1041 822 L 1032 831 L 1019 839 L 998 841 L 996 839 L 996 798 Z' },
  { id:'217',     number:'217',      area_m2:24.2,  status:'available', svg_path:'M 1127 798 L 1127 1041 L 1298 1041 L 1298 798 L 1237 798 L 1232 814 L 1220 829 L 1206 838 L 1184 841 L 1182 839 L 1182 798 Z' },
  { id:'216',     number:'216',      area_m2:25.56, status:'occupied',  svg_path:'M 1311 798 L 1311 1041 L 1471 1041 L 1471 798 L 1408 798 L 1403 814 L 1400 818 L 1398 818 L 1398 821 L 1391 829 L 1375 839 L 1354 841 L 1352 839 L 1352 798 Z' },
  { id:'215',     number:'215',      area_m2:25.4,  status:'occupied',  svg_path:'M 1484 798 L 1484 1041 L 1682 1041 L 1682 798 L 1612 798 L 1612 803 L 1609 806 L 1607 814 L 1603 818 L 1603 821 L 1595 829 L 1579 839 L 1558 841 L 1556 839 L 1556 798 Z' },
  { id:'213',     number:'213',      area_m2:14.8,  status:'occupied',  svg_path:'M 1805 655 L 1805 857 L 1931 857 L 1931 816 L 1926 815 L 1926 697 L 1931 696 L 1931 655 Z' },
  { id:'214',     number:'214',      area_m2:21.5,  status:'occupied',  svg_path:'M 1695 870 L 1695 1043 L 1709 1043 L 1710 1041 L 1931 1043 L 1931 1018 L 1926 1016 L 1926 899 L 1931 897 L 1931 870 L 1771 870 L 1771 875 L 1768 882 L 1757 898 L 1744 908 L 1736 910 L 1732 913 L 1717 913 L 1715 911 L 1715 870 Z' },
]

// Rooms 301 and 302 are SEPARATE — source drawing shows combined label but interaction must be split
const ROOMS_F3: RoomData[] = [
  { id:'301',  number:'301',  area_m2:null,  combined_area_m2:38.2, status:'occupied', serviceLabel:'Офис управляющей компании', svg_path:'M 145 324 L 145 545 L 208 545 L 209 551 L 310 551 L 310 468 L 298 466 L 286 458 L 273 457 L 273 454 L 278 448 L 273 444 L 272 437 L 270 435 L 270 422 L 266 418 L 265 413 L 267 401 L 274 399 L 278 403 L 277 419 L 279 419 L 287 407 L 286 404 L 284 404 L 283 407 L 280 407 L 279 403 L 283 399 L 288 399 L 292 404 L 292 408 L 286 417 L 292 417 L 293 419 L 310 419 L 310 324 L 277 324 L 276 326 L 171 326 L 170 324 Z' },
  { id:'302',  number:'302',  area_m2:null,  combined_area_m2:38.2, status:'occupied', serviceLabel:'Офис управляющей компании', svg_path:'M 321 324 L 321 551 L 350 551 L 351 515 L 366 515 L 381 523 L 387 528 L 395 539 L 399 551 L 424 551 L 424 324 Z' },
  { id:'303',  number:'303',  area_m2:24.3,  status:'available', svg_path:'M 435 324 L 435 551 L 490 551 L 491 515 L 506 515 L 521 523 L 527 528 L 535 539 L 539 551 L 584 551 L 584 326 L 541 326 L 540 324 L 523 324 L 522 326 L 443 326 L 442 324 Z' },
  { id:'304',  number:'304',  area_m2:21.9,  status:'occupied', svg_path:'M 595 326 L 595 551 L 638 551 L 639 515 L 654 515 L 669 523 L 675 528 L 683 539 L 687 551 L 750 551 L 750 324 L 745 324 L 744 326 L 665 326 L 664 324 L 647 324 L 646 326 Z' },
  { id:'305',  number:'305',  area_m2:20.0,  status:'occupied', svg_path:'M 759 324 L 759 551 L 798 551 L 799 515 L 814 515 L 829 523 L 835 528 L 843 539 L 847 551 L 890 551 L 890 324 L 867 324 L 866 326 L 787 326 L 786 324 Z' },
  { id:'306',  number:'306',  area_m2:23.8,  status:'occupied', svg_path:'M 899 324 L 899 551 L 954 551 L 955 515 L 970 515 L 985 523 L 991 528 L 999 539 L 1003 551 L 1058 551 L 1058 326 L 1009 326 L 1008 324 L 991 324 L 990 326 L 911 326 L 910 324 Z' },
  { id:'307',  number:'307',  area_m2:26.0,  status:'occupied', svg_path:'M 1069 326 L 1069 551 L 1120 551 L 1121 515 L 1136 515 L 1151 523 L 1157 528 L 1165 539 L 1169 551 L 1216 551 L 1216 324 L 1213 324 L 1212 326 L 1133 326 L 1132 324 L 1115 324 L 1114 326 Z' },
  { id:'308',  number:'308',  area_m2:21.9,  status:'occupied', svg_path:'M 1227 324 L 1227 551 L 1272 551 L 1273 515 L 1288 515 L 1303 523 L 1309 528 L 1317 539 L 1321 551 L 1374 551 L 1374 326 L 1341 326 L 1340 324 L 1323 324 L 1322 326 L 1243 326 L 1242 324 Z' },
  { id:'309',  number:'309',  area_m2:24.9,  status:'occupied', svg_path:'M 1385 326 L 1385 551 L 1454 551 L 1455 515 L 1470 515 L 1485 523 L 1491 528 L 1499 539 L 1503 551 L 1564 551 L 1564 324 L 1545 324 L 1544 326 L 1465 326 L 1464 324 L 1447 324 L 1446 326 Z' },
  { id:'324',  number:'324',  area_m2:21.2,  status:'occupied', svg_path:'M 209 636 L 209 655 L 213 656 L 213 741 L 209 742 L 209 763 L 422 763 L 422 742 L 412 738 L 401 730 L 392 718 L 388 709 L 389 693 L 422 693 L 422 636 Z' },
  { id:'323',  number:'323',  area_m2:23.0,  status:'occupied', svg_path:'M 209 774 L 209 795 L 213 796 L 213 881 L 209 882 L 209 901 L 422 901 L 422 850 L 414 850 L 401 842 L 390 828 L 386 819 L 387 803 L 422 803 L 422 774 Z' },
  { id:'326A', number:'326A', area_m2:40.4,  status:'occupied', svg_path:'M 520 636 L 519 901 L 576 901 L 577 899 L 583 899 L 585 901 L 585 905 L 620 905 L 620 901 L 622 899 L 625 901 L 710 901 L 710 636 Z' },
  { id:'326',  number:'326',  area_m2:12.9,  status:'occupied', serviceLabel:'Склад (служебное)', svg_path:'M 721 636 L 721 743 L 874 743 L 874 636 L 787 636 L 783 648 L 776 657 L 776 659 L 779 655 L 782 655 L 785 658 L 786 663 L 783 668 L 778 668 L 776 664 L 775 677 L 770 675 L 767 667 L 766 677 L 762 676 L 762 668 L 754 672 L 739 672 L 738 636 Z' },
  { id:'326B', number:'326Б', area_m2:17.3,  status:'occupied', svg_path:'M 721 754 L 721 901 L 732 901 L 733 899 L 739 899 L 741 901 L 741 905 L 776 905 L 776 901 L 778 899 L 781 901 L 874 901 L 874 754 Z' },
  { id:'327',  number:'327',  area_m2:21.1,  status:'occupied', svg_path:'M 885 636 L 885 763 L 1102 763 L 1102 636 L 1081 636 L 1077 648 L 1069 659 L 1057 668 L 1048 672 L 1032 671 L 1032 636 Z' },
  { id:'328',  number:'328',  area_m2:21.1,  status:'occupied', svg_path:'M 1113 636 L 1113 763 L 1330 763 L 1330 636 L 1193 636 L 1189 648 L 1181 659 L 1169 668 L 1160 672 L 1144 671 L 1144 636 Z' },
  { id:'329',  number:'329',  area_m2:22.2,  status:'occupied', svg_path:'M 1341 636 L 1341 763 L 1564 763 L 1564 636 Z' },
  { id:'330',  number:'330',  area_m2:15.65, status:'occupied', svg_path:'M 885 774 L 885 901 L 930 901 L 930 870 L 922 870 L 919 866 L 920 862 L 924 862 L 926 865 L 927 864 L 926 859 L 921 860 L 919 858 L 921 845 L 932 845 L 934 847 L 932 852 L 926 852 L 933 856 L 934 865 L 943 865 L 943 853 L 945 849 L 951 845 L 954 845 L 955 850 L 951 853 L 954 853 L 958 857 L 958 866 L 955 869 L 966 877 L 977 893 L 979 901 L 1034 901 L 1034 774 Z' },
  { id:'330A', number:'330A', area_m2:17.45, status:'occupied', svg_path:'M 1045 774 L 1045 901 L 1102 901 L 1102 866 L 1105 864 L 1110 865 L 1110 861 L 1119 845 L 1123 845 L 1125 847 L 1125 860 L 1127 861 L 1125 869 L 1139 878 L 1147 889 L 1151 901 L 1208 901 L 1208 774 Z' },
  { id:'331',  number:'331',  area_m2:13.6,  status:'occupied', svg_path:'M 1219 774 L 1219 901 L 1248 901 L 1248 871 L 1241 865 L 1242 862 L 1247 862 L 1249 865 L 1250 861 L 1245 859 L 1245 856 L 1249 855 L 1250 852 L 1249 851 L 1247 854 L 1243 854 L 1241 852 L 1247 845 L 1251 845 L 1256 849 L 1257 854 L 1255 858 L 1257 860 L 1257 865 L 1264 864 L 1266 867 L 1266 853 L 1268 849 L 1274 845 L 1278 846 L 1278 850 L 1274 853 L 1277 853 L 1281 857 L 1281 866 L 1275 871 L 1284 877 L 1295 893 L 1297 901 L 1348 901 L 1348 774 Z' },
  { id:'332',  number:'332',  area_m2:12.2,  status:'occupied', svg_path:'M 1357 774 L 1357 901 L 1384 901 L 1384 866 L 1389 864 L 1390 859 L 1394 860 L 1394 865 L 1405 867 L 1420 877 L 1429 889 L 1433 901 L 1460 901 L 1460 774 Z' },
  { id:'321',  number:'321',  area_m2:25.0,  status:'occupied', svg_path:'M 434 1002 L 434 1219 L 584 1219 L 584 1002 L 537 1002 L 535 1012 L 525 1027 L 513 1036 L 504 1040 L 488 1039 L 488 1002 Z' },
  { id:'320',  number:'320',  area_m2:23.5,  status:'occupied', svg_path:'M 595 1002 L 595 1219 L 750 1219 L 750 1002 L 685 1002 L 683 1012 L 673 1027 L 661 1036 L 652 1040 L 636 1039 L 636 1002 Z' },
  { id:'319',  number:'319',  area_m2:18.6,  status:'occupied', svg_path:'M 759 1002 L 759 1219 L 890 1219 L 890 1002 L 847 1002 L 845 1012 L 835 1027 L 823 1036 L 814 1040 L 798 1039 L 798 1002 Z' },
  { id:'318',  number:'318',  area_m2:23.9,  status:'occupied', svg_path:'M 899 1002 L 899 1219 L 1058 1219 L 1058 1002 L 1003 1002 L 1001 1012 L 991 1027 L 979 1036 L 970 1040 L 954 1039 L 954 1002 Z' },
  { id:'317',  number:'317',  area_m2:22.5,  status:'occupied', svg_path:'M 1069 1002 L 1069 1219 L 1222 1219 L 1222 1002 L 1169 1002 L 1167 1012 L 1157 1027 L 1145 1036 L 1136 1040 L 1120 1039 L 1120 1002 Z' },
  { id:'316',  number:'316',  area_m2:26.0,  status:'occupied', svg_path:'M 1233 1002 L 1233 1219 L 1376 1219 L 1376 1002 L 1321 1002 L 1319 1012 L 1309 1027 L 1297 1036 L 1288 1040 L 1272 1039 L 1272 1002 Z' },
  { id:'315',  number:'315',  area_m2:25.9,  status:'occupied', svg_path:'M 1387 1002 L 1387 1219 L 1564 1219 L 1564 1002 L 1503 1002 L 1501 1012 L 1491 1027 L 1479 1036 L 1470 1040 L 1454 1039 L 1454 1002 Z' },
  { id:'313',  number:'313',  area_m2:14.8,  status:'occupied', svg_path:'M 1673 874 L 1673 1055 L 1786 1055 L 1786 1018 L 1784 1017 L 1784 912 L 1786 911 L 1786 874 Z' },
  { id:'314',  number:'314',  area_m2:21.5,  status:'occupied', svg_path:'M 1575 1066 L 1575 1221 L 1590 1221 L 1591 1219 L 1786 1221 L 1786 1198 L 1784 1197 L 1784 1092 L 1786 1091 L 1786 1066 L 1645 1066 L 1643 1076 L 1633 1091 L 1621 1100 L 1612 1104 L 1596 1103 L 1596 1066 Z' },
]

type TenantInfo = {
  id: string
  full_name: string
  unit_number: string
  monthly_rent: number | null
  monthly_total: number | null
  contract_number: string | null
  contract_start_date: string | null
  tenant_group: string
  inn: string | null
}

type PathStyle = { fill: string; fillOpacity: number; stroke: string; strokeOpacity: number; strokeWidth: number }

export function FloorPlanPage({ onOpenTenant }: { onOpenTenant?: (id: string) => void }) {
  const [floor, setFloor] = useState(2)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [selId, setSelId]   = useState<string | null>(null)
  const [byUnit, setByUnit] = useState<Record<string, TenantInfo>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [debug] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    supabase
      .from('tenants')
      .select('id,full_name,unit_number,monthly_rent,monthly_total,contract_number,contract_start_date,tenant_group,inn')
      .not('unit_number', 'is', null)
      .then(({ data, error }) => {
        setLoading(false)
        if (error) setError(error.message)
        if (!data) return
        const map: Record<string, TenantInfo> = {}
        // Normalize Cyrillic А→A, Б→B so lookups match Latin keys in room data
        const norm = (s: string) => s.replace(/А/g, 'A').replace(/а/g, 'A').replace(/Б/g, 'B').replace(/б/g, 'B')
        for (const t of data) {
          const raw = t.unit_number as string
          for (const part of raw.split(/[,\s]+/)) {
            const p = part.trim()
            if (!p || /^ещё$/i.test(p) || /^и$/i.test(p)) continue
            for (const sub of p.includes('.') ? p.split('.') : [p]) {
              const c = sub.trim()
              if (c) map[norm(c).toUpperCase()] = t as TenantInfo
            }
          }
        }
        setByUnit(map)
      })
  }, [])
  useEffect(() => { load() }, [load])

  const getTenant = useCallback((room: RoomData): TenantInfo | null => {
    const norm = (s: string) => s.replace(/А/g, 'A').replace(/а/g, 'A').replace(/Б/g, 'B').replace(/б/g, 'B')
    for (const part of room.number.split(/[,\s]+/)) {
      const t = byUnit[norm(part.trim()).toUpperCase()]
      if (t) return t
    }
    return null
  }, [byUnit])

  useEffect(() => { setSelId(null) }, [floor])

  const rooms    = floor === 2 ? ROOMS_F2 : ROOMS_F3
  const viewBox  = floor === 2 ? '0 0 2048 1150' : '0 0 1984 1296'
  const imgW     = floor === 2 ? 2048 : 1984
  const imgH     = floor === 2 ? 1150 : 1296
  const floorImg = floor === 2 ? '/floorplan_f2.svg' : '/floorplan_f3.svg'

  const selRoom   = rooms.find(r => r.id === selId) ?? null
  const selTenant = selRoom ? getTenant(selRoom) : null
  // Room is free if: no tenant in DB AND not a service room (kitchen/warehouse/etc.)
  const isRoomFree = (r: RoomData) => !getTenant(r) && !r.serviceLabel
  const isFree = selRoom ? isRoomFree(selRoom) : false

  const areaLabel = (r: RoomData) => {
    if (r.area_m2 != null) return `${r.area_m2} м²`
    if (r.combined_area_m2 != null) return `${r.combined_area_m2} м² (совм.)`
    return '—'
  }

  // Цвета подсветки — из токенов темы: свободно — зелёный, наведение — акцент, выбранный — янтарный.
  const getPathStyle = (r: RoomData): PathStyle => {
    const isSel     = selId === r.id
    const isHover   = hoverId === r.id && !isSel
    // Dynamic: green if no tenant in DB and not a service room
    const isFreeRoom = isRoomFree(r)

    if (debug) {
      const c = isSel ? C.amber : isFreeRoom ? C.green : C.accent
      return { fill: c, fillOpacity: isSel ? 0.55 : isFreeRoom ? 0.4 : 0.25, stroke: c, strokeOpacity: 0.9, strokeWidth: 2 }
    }

    if (isSel) return { fill: C.amber, fillOpacity: 0.28, stroke: C.amber, strokeOpacity: 0.95, strokeWidth: 4 }
    if (isFreeRoom && isHover) return { fill: C.green, fillOpacity: 0.3, stroke: C.green, strokeOpacity: 0.95, strokeWidth: 3 }
    if (isFreeRoom) return { fill: C.green, fillOpacity: 0.12, stroke: C.green, strokeOpacity: 0.7, strokeWidth: 2 }
    if (isHover) return { fill: C.accent, fillOpacity: 0.2, stroke: C.accent, strokeOpacity: 0.95, strokeWidth: 3 }
    return { fill: C.card, fillOpacity: 0, stroke: C.card, strokeOpacity: 0, strokeWidth: 0 }
  }

  const legend: { color: string; label: string }[] = [
    { color: C.green, label: 'Свободно' },
    { color: C.accent, label: 'Наведение' },
    { color: C.amber, label: 'Выбрано' },
  ]

  return (
    <Page>
      <Row gap={12}>
        <Segmented<'2' | '3'> value={String(floor) as '2' | '3'} onChange={k => setFloor(Number(k))} options={[['2', '2 этаж'], ['3', '3 этаж']]} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, fontSize: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {legend.map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width={14} height={14} aria-hidden="true" style={{ flexShrink: 0 }}>
                <rect x={0.75} y={0.75} width={12.5} height={12.5} rx={2} style={{ fill: s.color, fillOpacity: 0.2, stroke: s.color, strokeWidth: 1.5 }} />
              </svg>
              <span style={{ color: C.muted, fontWeight: 500 }}>{s.label}</span>
            </div>
          ))}
        </div>
      </Row>

      {error && <ErrorBox error={error} onRetry={load} />}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' }}>
        {/* Floor plan — single SVG with image + hit areas in the same coordinate system */}
        <div style={{ flex: '1 1 560px', minWidth: 0 }}>
          <Card title={<span style={{ fontWeight: 500, color: C.muted, fontSize: 13 }}>БЦ Маяк · {floor} этаж — нажмите на кабинет{loading ? ' · загрузка арендаторов…' : ''}</span>}>
            <svg
              viewBox={viewBox}
              width="100%"
              preserveAspectRatio="xMidYMid meet"
              xmlns="http://www.w3.org/2000/svg"
              style={{ display: 'block', borderRadius: 6, height: 'auto' }}
            >
              {/* Floor plan image — same coordinate space as hit paths */}
              <image
                href={floorImg}
                x={0} y={0}
                width={imgW} height={imgH}
                preserveAspectRatio="xMidYMid meet"
              />

              {/* Exact SVG path hit areas — pixel-accurate, from floorplans_hitareas_EXACT.json */}
              <g>
                {rooms.map(r => {
                  const s = getPathStyle(r)
                  return (
                    <path
                      key={r.id}
                      d={r.svg_path}
                      strokeLinejoin="round"
                      style={{ cursor: 'pointer', fill: s.fill, fillOpacity: s.fillOpacity, stroke: s.stroke, strokeOpacity: s.strokeOpacity, strokeWidth: s.strokeWidth }}
                      onMouseEnter={() => setHoverId(r.id)}
                      onMouseLeave={() => setHoverId(null)}
                      onClick={() => setSelId(selId === r.id ? null : r.id)}
                    />
                  )
                })}
              </g>
            </svg>
          </Card>
        </div>

        {/* Sidebar */}
        {selRoom && (
          <div style={{ flex: '1 1 260px', maxWidth: 360, minWidth: 0 }}>
          <Card title={`Кабинет № ${selRoom.number}`} actions={<Button small kind="ghost" onClick={() => setSelId(null)}>Закрыть</Button>}>
            <div style={{ display: 'grid', gap: 0 }}>
              <div style={{ marginBottom: 10 }}><Badge tone={isFree ? 'green' : 'blue'}>{isFree ? 'Свободен' : 'Занято'}</Badge></div>
              <InfoRow label="Площадь" value={areaLabel(selRoom)} />

              {selTenant && (
                <>
                  <div style={{ fontSize: 14, fontWeight: 600, margin: '12px 0 6px', lineHeight: 1.4 }}>{selTenant.full_name}</div>
                  <InfoRow label="Аренда" value={money(selTenant.monthly_rent, { zero: '—' })} />
                  <InfoRow label="Итого в мес." value={money(selTenant.monthly_total, { zero: '—' })} />
                  <InfoRow label="Договор №" value={selTenant.contract_number || '—'} />
                  <InfoRow label="Дата начала" value={dateRu(selTenant.contract_start_date)} />
                  <InfoRow label="ИНН" value={selTenant.inn || '—'} />
                  <Button kind="primary" onClick={() => onOpenTenant?.(selTenant.id)} style={{ marginTop: 14, width: '100%' }}>Открыть карточку арендатора</Button>
                </>
              )}

              {!selTenant && (
                <div style={{ marginTop: 10 }}><Muted small>{selRoom.serviceLabel ?? 'Нет данных об арендаторе'}</Muted></div>
              )}
            </div>
          </Card>
          </div>
        )}
      </div>
    </Page>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '6px 0', borderBottom: `1px solid ${C.line}` }}>
      <span style={{ fontSize: 12, color: C.muted }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  )
}
