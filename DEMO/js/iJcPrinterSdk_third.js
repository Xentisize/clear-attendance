//单页数据打印份数
const jsonObj = {
    "printerImageProcessingInfo": {
        "printQuantity": 1,
    }
};


//SDK初始化参数
const data = {
    initSdkParam: {
        "fontDir": "",
    }
};

let selectDensity = null;
let selectLabelType = null;
let selectPrintMode = null;
let selectAutoShutDown = null;
let isPrinterConnected = false;

/*是否正在绘制
3.2.1版本添加，用于修复绘制内容较多时，第1页打印完成，第二页内容未绘制完成时，commitJob上报回调”commitjob ok“导致的打印异常
3.2.4该BUG修复后 移除此处代码
 */
let isDrawing = false;
//所有打印机
let allUsbPrinters;

window.onload = function () {

    const service_status = document.querySelector('.service_status');
    let isConnected = false;
    const usb_connect_status = document.querySelector('.usb_printer_connect_status');
    const wifi_connect_status = document.querySelector('.wifi_printer_connect_status');

    let isSupported = true;
    //连接打印服务
    getInstance(() => {
        isConnected = true;
        console.log('打印服务连接成功');
    }, () => {
        isSupported = false;
        console.log('当前浏览器不支持打印服务');
    }, () => {
        isConnected = false;
        console.log('打印服务连接断开');
    }, () => {
        isPrinterConnected = false;

    });

    setInterval(() => {
        if (isConnected) {
            service_status.textContent = '打印服务状态：已连接';
        } else if (!isSupported) {
            service_status.textContent = '打印服务状态：不支持';
        } else {
            service_status.textContent = '打印服务状态：未连接';
        }


    }, 500);

    setInterval(() => {
        if (!isPrinterConnected) {
            usb_connect_status.textContent = '打印机连接状态：未连接';
            wifi_connect_status.textContent = '打印机连接状态：未连接';
        }


    }, 500);

    //初始化浓度、纸张类型、打印模式默认值
    selectDensity = document.getElementById('density');
    selectDensity.selectedIndex = 2;

    selectLabelType = document.getElementById('label_type');
    selectLabelType.selectedIndex = 0;

    selectPrintMode = document.getElementById('print_mode');
    selectPrintMode.selectedIndex = 0;


    selectAutoShutDown = document.getElementById('auto_shut_down');
    selectPrintMode.selectedIndex = 0;

    selectAutoShutDown.addEventListener('change', () => {
        switch (selectAutoShutDown.value) {
            case '1挡':
            default:
                setPrinterAutoShutDownTime(1, function (error, data) {

                    if (error) {
                        return alert(error.message);
                    }
                    const {errorCode, info} = JSON.parse(JSON.stringify(data)).resultAck;


                    if (errorCode === 0) {
                        console.log('设置成功');
                        return alert('设置成功');
                    } else {
                        return alert(info);
                    }

                });
                break;
            case '2挡':

                setPrinterAutoShutDownTime(2, function (error, data) {
                    if (error) {
                        return alert(error.message);
                    }
                    const {errorCode, info} = JSON.parse(JSON.stringify(data)).resultAck;


                    if (errorCode === 0) {
                        console.log('设置成功');
                        return alert('设置成功');
                    } else {
                        return alert(info);
                    }
                });


                break;
            case '3挡':

                setPrinterAutoShutDownTime(3, function (error, data) {
                    if (error) {
                        return alert(error.message);
                    }
                    const {errorCode, info} = JSON.parse(JSON.stringify(data)).resultAck;


                    if (errorCode === 0) {
                        console.log('设置成功');
                        return alert('设置成功');
                    } else {
                        return alert(info);
                    }
                });


                break;
            case '4挡':

                setPrinterAutoShutDownTime(4, function (error, data) {
                    if (error) {
                        return alert(error.message);
                    }
                    const {errorCode, info} = JSON.parse(JSON.stringify(data)).resultAck;
                    if (errorCode === 0) {
                        console.log('设置成功');
                        return alert('设置成功');
                    } else {
                        return alert(info);
                    }
                });


                break;
        }

    });
}


function getWifiConfigurationInfo() {
    getWifiConfiguration(function (error, data) {
        if (error) {
            return alert(error.message);
        }

        const {errorCode, info} = JSON.parse(JSON.stringify(data)).resultAck;


        if (errorCode === 0) {
            const infoObj = JSON.parse(info)

            return alert("获取配置信息成功-Wifi名称为:" + infoObj.wifiName);
        } else {
            return alert(info);
        }


    });
}


function setWifiConfiguration() {
    let name = document.getElementById('wifi_name');
    let password = document.getElementById('wifi_password');
    console.log(name.value);
    console.log(password.value);
    if (name.value.trim() !== "") {
        configurationWifi(name.value, password.value, function (error, data) {
            if (error) {
                return alert(error.message);
            }


            const {errorCode, info} = JSON.parse(JSON.stringify(data)).resultAck;

            if (errorCode === 0) {
                return alert("网络配置成功，请断开USB线缆后使用WIFI搜索连接打印机（PC需要和打印机在同一网络）");
            } else {
                return alert(info);
            }


        });
    }


}


//初始化SDK
function init() {
    let status = document.querySelector('.init_status')
    initSdk(data.initSdkParam, function (error, data) {
        if (error) {
            return alert(error.message);
        }
        const {errorCode, info} = JSON.parse(JSON.stringify(data)).resultAck;


        if (errorCode === 0) {
            console.log('初始化成功');
            status.textContent = "SDK初始化状态：已初始化"
        } else {
            console.log('初始化失败');
            status.textContent = "SDK初始化状态：未初始化"
            return alert(info);
        }

    });
}



//更新打印机列表
function getUsbPrinters() {

    console.log('开始获取打印机');
    getAllPrinters(function (error, data) {
        if (error) {
            return alert(error.message);
        }

        try {
            const {errorCode, info} = JSON.parse(JSON.stringify(data)).resultAck;
            if (errorCode === 0) {
                allUsbPrinters = JSON.parse(info);
                const allPrintersName = Object.keys(allUsbPrinters);
                const select = document.getElementById("usb_printers");
                let selectSize = select.options.length;
                console.log("selectSize", selectSize);
                console.log("select", select);
                if (allPrintersName.length > 0 && selectSize > 0) {
                    while (select.firstChild) {
                        select.removeChild(select.firstChild);
                    }
                }

                allPrintersName.forEach((name) => {
                    const option = document.createElement('option');
                    option.value = name;
                    option.text = name;
                    select.appendChild(option);
                });
            } else {
                console.log('无打印机在线');
                const select = document.getElementById("usb_printers");
                select.innerHTML = "";
                const option = document.createElement('option')
                option.value = '请选择USB打印机';
                option.text = '请选择USB打印机';
                select.appendChild(option);
                return alert('无打印机在线');
            }
        } catch (err) {
            console.log(err);
        }


    });


}

var allPrintersNameAndPortArray;

//更新打印机列表
function scanWifiPrinters() {

    console.log('开始获取打印机');
    scanWifiPrinter(function (error, data) {
        if (error) {
            return alert(error.message);
        }

        try {

            const {errorCode, info} = JSON.parse(JSON.stringify(data)).resultAck;
            if (errorCode === 0) {
                allPrintersNameAndPortArray = info.map(function (item) {
                    return {
                        deviceName: item.deviceName,
                        tcpPort: item.tcpPort
                    }

                });

                console.log(allPrintersNameAndPortArray);
                const select = document.getElementById("wifi_printers");
                let selectSize = select.options.length;
                console.log("selectSize", selectSize);
                console.log("select", select);
                if (allPrintersNameAndPortArray.length > 0 && selectSize > 0) {
                    while (select.firstChild) {
                        select.removeChild(select.firstChild);
                    }
                }

                allPrintersNameAndPortArray.forEach((item) => {
                    const option = document.createElement('option');
                    console.log(item.deviceName);
                    console.log(item.tcpPort);
                    option.value = item.deviceName;
                    option.text = item.deviceName + ":" + item.tcpPort;
                    select.appendChild(option);
                });
            } else {
                console.log('无打印机在线');
                const select = document.getElementById("wifi_printers");
                select.innerHTML = "";
                const option = document.createElement('option')
                option.value = '请选择WIFI打印机';
                option.text = '请选择WIFI打印机';
                select.appendChild(option);
                return alert('无打印机在线');
            }
        } catch (err) {
            console.log(err);
        }


    });


}


//选择在线打印机
function selectOnLineUsbPrinter() {
    isPrinterConnected = false;

    if (allUsbPrinters) {
        const usb_connect_status = document.querySelector('.usb_printer_connect_status');
        const wifi_connect_status = document.querySelector('.wifi_printer_connect_status');
        const select = document.getElementById("usb_printers");
        const allPrintersName = Object.keys(allUsbPrinters);
        const allPrintersValue = Object.values(allUsbPrinters);
        selectPrinter(allPrintersName[select.selectedIndex], parseInt(allPrintersValue[select.selectedIndex]), function (error, data) {
            if (error) {
                console.log('连接失败')
                usb_connect_status.textContent = '打印机连接状态：未连接';
                return alert(error.message);
            }

            const {errorCode} = JSON.parse(JSON.stringify(data)).resultAck;


            if (errorCode === 0) {
                console.log('连接成功')
                isPrinterConnected = true;
                usb_connect_status.textContent = '打印机连接状态：USB打印机已连接';
                wifi_connect_status.textContent = '打印机连接状态：未连接';
            } else {
                console.log('连接失败')
                usb_connect_status.textContent = '打印机连接状态：未连接';
                wifi_connect_status.textContent = '打印机连接状态：未连接';
                alert('连接失败');
            }


        })
    } else {
        console.log('未选择打印机')
        alert('未选择打印机');
    }


}

//选择在线打印机
function selectOnLineWifiPrinter() {
    isPrinterConnected = false;
    console.log(allPrintersNameAndPortArray);
    if (allPrintersNameAndPortArray) {
        const usb_connect_status = document.querySelector('.usb_printer_connect_status');
        const wifi_connect_status = document.querySelector('.wifi_printer_connect_status');
        const select = document.getElementById("wifi_printers");

        connectWifiPrinter(allPrintersNameAndPortArray[select.selectedIndex].deviceName, parseInt(allPrintersNameAndPortArray[select.selectedIndex].tcpPort), function (error, data) {
            if (error) {
                console.log('连接失败')
                wifi_connect_status.textContent = '打印机连接状态：未连接';
                return alert(error.message);
            }

            // const { errorCode } = JSON.parse(JSON.stringify(data)).resultAck;
            // if (errorCode === 0) {
            // 	console.log('连接成功')
            // 	isPrinterConnected = true;
            // 	wifi_connect_status.textContent = '打印机连接状态：Wifi打印机已连接';
            // 	usb_connect_status.textContent = '打印机连接状态：未连接';
            // } else {
            // 	console.log('连接失败')
            // 	wifi_connect_status.textContent = '打印机连接状态：未连接';
            // 	alert('连接失败');
            // }

            //此版文报存在问题，errorCode连接成功与连接失败一致，暂时先用result判断
            const {result} = JSON.parse(JSON.stringify(data)).resultAck;


            if (result) {
                console.log('连接成功')
                isPrinterConnected = true;
                wifi_connect_status.textContent = '打印机连接状态：Wifi打印机已连接';
                usb_connect_status.textContent = '打印机连接状态：未连接';
            } else {
                console.log('连接失败')
                usb_connect_status.textContent = '打印机连接状态：未连接';
                wifi_connect_status.textContent = '打印机连接状态：未连接';
                alert('连接失败');
            }


        })
    } else {
        console.log('未选择打印机')
        alert('未选择打印机');
    }


}

function startBatchPrintJobTest(content) {
    if (content == null || content.length === 0) {
        return;
    }
    batchPrintJob(content.data);
}

function startPrintJobTest(content) {
    let contentArr = [];
    contentArr.push(content);
    batchPrintJob(contentArr);
}


function previewTest(content) {
    const previewImg = document.querySelector('#preview');
    if (previewImg) {
        previewImg.remove();
    }

    const self = this
    if (content == null) {
        return;
    }

    let contentArr = [];
    contentArr.push(content);
    console.log('开始预览');
    self.printTag(contentArr, 0, true);

}

function batchPrintJob(list) {
    const self = this

    if (list == null || list.length === 0) {
        return;
    }

    //打印份数
    var printQuantity = jsonObj.printerImageProcessingInfo.printQuantity

    let density = 3;
    let labelType = 1;
    let printMode = 1;

    if (selectDensity != null) {
        density = parseInt(selectDensity.value);
    }

    if (selectLabelType != null) {
        switch (selectLabelType.value) {
            case '间隙纸':
            default:
                labelType = 1;
                break;
            case '黑标纸':
                labelType = 2;
                break;
            case '连续纸':
                labelType = 3;
                break;
            case '定孔纸':
                labelType = 4;
                break;
            case '透明纸':
                labelType = 5;
                break;
            case '标牌':
                labelType = 5;
                break;

        }

    }

    if (selectPrintMode != null) {
        switch (selectPrintMode.value) {
            case '热敏模式':
            default:
                printMode = 1;
                break;
            case '热转印模式':
                printMode = 2;
                break;

        }

    }


    console.log('打印浓度:' + density);
    console.log('纸张类型:' + labelType);
    console.log('打印模式:' + printMode);
    console.log('总打印份数:' + list.length * printQuantity);
    //总打印份数，表示所有页面的打印份数之和。例如，如果你有3页需要打印，第一页打印3份，第二页打印2份，第三页打印5份，那么count的值应为10（3+2+5）。
    startJob(density, labelType, printMode, list.length * printQuantity, function (error, data) {
        if (error) {
            return alert(error.message);
        }
        const {errorCode, info} = JSON.parse(JSON.stringify(data)).resultAck;
        if (errorCode !== 0) {
            return alert(info);
        }
        // 提交打印任务
        self.printTag(list, 0, false);
    });


}

function printTag(list, x, isPreview) {
	//是否正在绘制状态修改，开始绘制
	isDrawing = true;
    //设置画布尺寸
    InitDrawingBoard(list[x].InitDrawingBoardParam, function (error, data) {
        if (error) {
            return alert(error.message);
        }
        const {errorCode, info} = JSON.parse(JSON.stringify(data)).resultAck;
        if (errorCode !== 0) {
            return alert(info);
        }

        // 元素控件绘制
        printItem(list, x, list[x].elements, 0, isPreview);

    });
}


function printItem(list, x, item, i, isPreview) {
    console.log(item, 'item');
    if (i < item.length) {
        switch (item[i].type) {

            case 'text':
                console.log(item[i].json);
                //绘制文本
                DrawLableText(item[i].json, function (error, data) {
                    if (error) {
                        return alert(error.message);
                    }
                    const {errorCode, info} = JSON.parse(JSON.stringify(data)).resultAck;
                    if (errorCode !== 0) {
                        return alert(info);
                    }

                    i++;
                    printItem(list, x, item, i, isPreview);
                });
                break;
            case 'qrCode':
                //绘制二维码
                DrawLableQrCode(item[i].json, function (error, data) {
                    if (error) {
                        return alert(error.message);
                    }
                    const {errorCode, info} = JSON.parse(JSON.stringify(data)).resultAck;
                    if (errorCode !== 0) {
                        return alert(info);
                    }

                    i++;
                    printItem(list, x, item, i, isPreview);
                });

                break;
            case 'barCode':
                //绘制一维码
                DrawLableBarCode(item[i].json, function (error, data) {
                    if (error) {
                        return alert(error.message);
                    }
                    const {errorCode, info} = JSON.parse(JSON.stringify(data)).resultAck;
                    if (errorCode !== 0) {
                        return alert(info);
                    }

                    i++;
                    printItem(list, x, item, i, isPreview);
                });
                break;
            case 'line':

                //绘制线条
                DrawLableLine(item[i].json, function (error, data) {
                    if (error) {
                        return alert(error.message);
                    }
                    const {errorCode, info} = JSON.parse(JSON.stringify(data)).resultAck;
                    if (errorCode !== 0) {
                        return alert(info);
                    }

                    i++;
                    printItem(list, x, item, i, isPreview);
                });
                break;
            case 'graph':
                //绘制边框
                DrawLableGraph(item[i].json, function (error, data) {
                    if (error) {
                        return alert(error.message);
                    }
                    const {errorCode, info} = JSON.parse(JSON.stringify(data)).resultAck;
                    if (errorCode !== 0) {
                        return alert(info);
                    }

                    i++;
                    printItem(list, x, item, i, isPreview);
                });
                break;
            case 'image':
                //绘制边框
                DrawLableImage(item[i].json, function (error, data) {
                    if (error) {
                        return alert(error.message);
                    }
                    const {errorCode, info} = JSON.parse(JSON.stringify(data)).resultAck;
                    if (errorCode !== 0) {
                        return alert(info);
                    }

                    i++;
                    printItem(list, x, item, i, isPreview);
                });
                break;
        }
    } else { //遍历完成，开始打印
        // let index = Object.assign(x);
        // var jsonObj = {
        // 		"printerImageProcessingInfo": {
        // 		"width": width,
        // 		"height": height,
        // 		"margin": [0,0,0,0],
        // 		"printQuantity":1,
        // 		"epc":"1234"
        // 	}
        // };

        console.log('是否预览' + isPreview);
        if (isPreview) {
            //B32和T8等300点机型倍率填12，其他机器填8，默认值8
            generateImagePreviewImage(8, function (error, data) {
                if (error) {
                    return alert(error.message);
                }

                const {errorCode, info} = JSON.parse(JSON.stringify(data)).resultAck;
                if (errorCode !== 0) {
                    return alert(info);
                }

                const imageData = "data:image/jpeg;base64," + JSON.parse(info).ImageData;
                const img = new Image();
                img.src = imageData;

                img.id = 'preview';

                document.body.appendChild(img);

                // var bg = document.querySelector('.preview_bg');
                // bg.style.background ='url("./img/supermarket_retail.png")';
                // bg.style.backgroundSize = 'cover';
                // console.log(bg);
                // const img = document.createElement('img');
                // img.src = "./img/supermarket_retail.png";

                // bg.appendChild(img);

            });

            return;
        }

		//是否正在绘制状态修改,绘制完成
		isDrawing = false;
        // var jsonObj ={"printerImageProcessingInfo": {"printQuantity": 1,}}; printQuantity属性用于指定当前页的打印份数。
        // 例如，如果你需要打印3页，第一页打印3份，第二页打印2份，第三页打印5份，那么在3次提交数据时，printerImageProcessingInfo中的printQuantity值分别应为3，2，5。
        commitJob(null, JSON.stringify(jsonObj), function (error, data) {
            if (error) {
                return alert(error.message);
            }

            const {errorCode, info, printQuantity, onPrintPageCompleted} = JSON.parse(JSON.stringify(data)).resultAck;
            const resultInfo = "commitJob ok";
            //异常导致打印终止
            if (errorCode !== 0) {
                return alert(info);
            }


            //回调与传参定义相反，考虑接入较多客户暂不修改为一致
            //var jsonObj = {		"printerImageProcessingInfo": {"printQuantity":2,}}; 提交任务的打印份数
            //printQuantity 回调打印页数的进度（一次commitJob提交为1页，内容可以不一样）
            //onPrintPageCompleted 回调打印份数的进度（一个commit的内容打印多张，内容一样）

            //回调页码为数据总长度且回调打印份数数据等于当前页需要打印的份数数据时，结束打印任务
            if (printQuantity === list.length && onPrintPageCompleted === jsonObj.printerImageProcessingInfo.printQuantity) {
                //结束打印任务
                endJob(function (error, data) {
                    if (error) {
                        alert(error.message);
                    } else {
                        const arrParse = JSON.parse(JSON.stringify(data));
                        if (String(arrParse.resultAck.info).indexOf("endJob ok") > -1) {

                        }
                    }

                });
                return;
            }

            //当前页数据提交完成，但是未完所有页数据提交，且未进行绘制，继续发送下一页数据
            if (String(info).indexOf(resultInfo) > -1 && x < list.length - 1&&!isDrawing) {
                //数据提交成功，数据下标+1
                console.log("发送下一页打印数据： ")
                x++;
                printTag(list, x);
            }

        });
    }
}


function printerDetails(printModel) {
    switch (printModel) {
        case 'B3S':
            alert('B3S支持范围说明:\n打印模式支持：热敏\n打印浓度范围：1-5，建议值为3\n打印纸张类型支持：间隙纸、黑标纸、连续纸、透明纸');
            break;
        case 'B1':
            alert('B1支持范围说明:\n打印模式支持：热敏\n打印浓度范围：1-5，建议值为3\n打印纸张类型支持：间隙纸、黑标纸、透明纸');
            break;
        case 'B203':
            alert('B203支持范围说明:\n打印模式支持：热敏\n打印浓度范围：1-5，建议值为3\n打印纸张类型支持：间隙纸、黑标纸、透明纸');
            break;
        case 'B21':
            alert('B21支持范围说明:\n打印模式支持：热敏\n打印浓度范围：1-5，建议值为3\n打印纸张类型支持：间隙纸、黑标纸、连续纸、透明纸');
            break;
        case 'D11/D101/D110/B16':
            alert('D11/D101/D110/B16支持范围说明:\n打印模式支持：热敏\n打印浓度范围：1-3，建议值为2\n打印纸张类型支持：间隙纸、透明纸');
            break;
        case 'B32':
            alert('B32支持范围说明:\n打印模式支持：热转印\n打印浓度范围：1-15，建议值为8\n打印纸张类型支持：间隙纸、透明纸');
            break;
        case 'Z401':
            alert('Z401支持范围说明:\n打印模式支持：热转印\n打印浓度范围：1-15，建议值为8\n打印纸张类型支持：间隙纸、透明纸');
            break;
        case 'B50/B50W':
            alert('B50/B50W支持范围说明:\n打印模式支持：热转印\n打印浓度范围：1-15，建议值为8\n打印纸张类型支持：间隙纸');
            break;
        case 'B18':
            alert('B18支持范围说明:\n打印模式支持：热转印\n打印浓度范围：1-3，建议值为2\n打印纸张类型支持：间隙纸');
            break;
        case 'K3/K3W':
            alert('K3/K3W支持范围说明:\n打印模式支持：热敏\n打印浓度范围：1-5，建议值为3\n打印纸张类型支持：间隙纸、黑标纸、透明纸');
            break;
        case 'M2':
            alert('M2支持范围说明:\n打印模式支持：热转印\n打印浓度范围：1-5，建议值为3\n打印纸张类型支持：间隙纸、黑标纸、透明纸');
            break;
        default:
            break;
    }
}

