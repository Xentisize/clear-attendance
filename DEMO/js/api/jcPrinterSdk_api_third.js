//websocket
var websocket;


/* //响应数据 */
var ackJsonData;
/**消息列表 */
var MessageList = {};

let timeoutTimer;
var timeout_duration = 10000;

/**通过websocket发送消息 */
function sendMsg(msg, callback) {
  console.log("timeout_duration",timeout_duration)
  console.log('sendMsg', msg.apiName);
  MessageList[msg.apiName] = callback;

  var data = JSON.stringify(msg);

  var tryTimes = 10;

  if (!websocket || websocket.readyState !== WebSocket.OPEN) {

    if (callback && typeof callback === 'function') {
      callback(new Error("打印服务未开启"))
    }

    return;
  }
  timeoutTimer = setTimeout(function () {
    // //超时关闭打印服务，进入重连机制
    // websocket.close();
    if (callback && typeof callback === 'function') {
      console.log('回调超时');
      callback(new Error("打印服务消息接收超时"))
    }
  }, timeout_duration);

  for (var i = 0; i < tryTimes; i++) {
    websocket.send(data);
    return;
  }
}

/**
 * 初始化打印服务，连接打印服务
 *
 * @param {function} onServiceConnected - 当打印服务连接建立时调用的回调函数。
 * @param {function} onNotSupportedService - 当打印服务服务不支持时调用的回调函数。
 * @param {function} onServiceDisconnected - 当打印服务连接断开时调用的回调函数。
 * @param {function} onPrinterDisConnect - 当打印机离线时调用的回调函数。
 * @return {undefined} 该函数没有返回值。
 * 
 * @description
 * 1. 所有接口的调用前提是先调用该接口进行打印服务连接。
 * 2. 调用成功后会停止初始化打印服务，如果未调用成功，会间隔3秒调用一次，直到成功连接为止。
 * 3. 建议在页面加载时调用该接口，回调成功后依次调用初始化SDK、获取打印机、选择打印机等接口。
 */
function getInstance(onServiceConnected, onNotSupportedService, onServiceDisconnected, onPrinterDisConnect) {
  //是否已连接
  let isConnected = false;
  //是否已重连
  let isReconnecting = false;
  //重连时间
  let reconnectTimer = null;

  const connect = () => {

    if ('WebSocket' in window) {
      websocket = new WebSocket('ws://127.0.0.1:37989');
      if ('binaryType' in WebSocket.prototype) {
        websocket.binaryType = 'arraybuffer';

      }

      if ('timeout' in WebSocket.prototype) {
        websocket.timeout = 5000;
      }


      websocket.addEventListener('open', (event) => {
        isConnected = true;
        isReconnecting = false;
        console.log('WebSocket connected !');
        clearInterval(reconnectTimer);
        onServiceConnected();
      });


      websocket.addEventListener('error', (event) => {
        if (timeoutTimer != null) {
          clearTimeout(timeoutTimer);
        }

        isConnected = false;
        ackJsonData = '';
        console.log('WebSocket error !', event);
        if (!isReconnecting) {
          isReconnecting = true;
          onServiceDisconnected();
          reconnect();
        }

      });

      websocket.addEventListener('close', (event) => {
        if (timeoutTimer != null) {
          clearTimeout(timeoutTimer);
        }
        isConnected = false;
        ackJsonData = '';
        console.log('WebSocket close !', event);
        if (!isReconnecting) {
          isReconnecting = true;
          onServiceDisconnected();
          reconnect();
        }

      });

      websocket.addEventListener('message', (event) => {

        if (timeoutTimer != null) {
          console.log('收到消息');
          clearTimeout(timeoutTimer);
        }

        readCallback(event, () => {
          onPrinterDisConnect();
        });
      });

    } else {
      onNotSupportedService();
    }


  };

  const reconnect = () => {
    if (!isConnected && isReconnecting) {
      clearInterval(reconnectTimer);
      reconnectTimer = setInterval(connect, 3000);
    }
  };

  connect();
}


/**
 * 从事件对象中读取回调信息，并根据接收到的数据执行各种操作。
 *
 * @param {object} event - 包含回调信息的事件对象。
 * @param {function} onPrinterDisConnect - 打印机断开连接时要执行的回调函数。
 * @return {undefined} 此函数没有返回值。
 */
function readCallback(event, onPrinterDisConnect) {
  var callBackInfo = event.data;
  console.log('readCallback', callBackInfo);
  ackJsonData = callBackInfo;

  var callbackName;

  if (isJSON(ackJsonData)) {
    var arrParse = JSON.parse(ackJsonData);


    //接口回调
    if (!!MessageList[arrParse.apiName]) {
      MessageList[arrParse.apiName](null, arrParse);
    }

    if (arrParse.apiName == 'configurationWifi') {
      timeout_duration = 10000
    }
    

    //回调分发
    if (arrParse.apiName == 'printStatus') {
      if (arrParse['resultAck']['online'] == 'offline') {
        onPrinterDisConnect();

      }

    } else {
      if (arrParse['resultAck']['callback'] != undefined) {
        callbackName = arrParse['resultAck']['callback']['name'];
       
        if (callbackName == 'onCoverStatusChange') {
          var coverStatus = arrParse['resultAck']['callback']['coverStatus'];
          onCoverStatusChange(coverStatus);
        } else if (callbackName == 'onElectricityChange') {
          var powerLever = arrParse['resultAck']['callback']['powerLever'];
          onElectricityChange(powerLever);
        }else{
          console.log('无需处理');
        }
      }
    }

    ackJsonData = '';
  }
}



/**
 * 打印机上盖状态变化回调函数。
 *
 * @param {type} coverStatus - 打印机上盖状态，0为上盖开启,1为上盖关闭
 * 
 */
function onCoverStatusChange(coverStatus) {
  console.log('打印机盒盖有变化！');
}

/**
 * 打印机电量变化回调函数。
 *
 * @param {type} powerLever - 电量等级，取值范围1-4，满格电为4
 * 
 */
function onElectricityChange(powerLever) {
  console.log('打印机电量有变化！');
}





/**
 * 初始化SDK，在打印服务连接成功后调用此接口。
 * 在调用SDK的绘制接口之前，必须先调用此接口。
 *
 * @param {object} json - 包含必要参数的JSON对象,格式如下：
 *  {
 *   "fontDir": string, //字体文件目录，默认为""，暂不生效
 * }
 * @param {function} callbackFunction - 发送消息后执行的回调函数。
 * @return {undefined} 该函数没有返回值。
 */
function initSdk(json, callbackFunction) {
  var jsonObj = {
    apiName: 'initSdk',
    parameter: json
  };

  sendMsg(jsonObj, callbackFunction);
}


/**
 * 获取所有打印机信息。
 *
 * @param {function} callbackFunction - 获取信息后执行的回调函数。
 * @return {undefined} 该函数没有返回值。
 *
 * @description
 * 需要在打印服务连接成功后调用此函数，建议在打印服务连接成功的回调函数中调用。
 * 注意：此函数只能获取 USB连接的打印机列表。
 */
function getAllPrinters(callbackFunction) {
  //刷新设备时，关闭设备
  //closePrinter();
  var jsonObj = { apiName: 'getAllPrinters' };

  sendMsg(jsonObj, callbackFunction);
}

/**
 * 获取所有打印机信息。
 *
 * @param {function} callbackFunction - 获取信息后执行的回调函数。
 * @return {undefined} 该函数没有返回值。
 *
 * @description
 * 需要在打印服务连接成功后调用此函数，建议在打印服务连接成功的回调函数中调用。
 * 注意：此函数只能获取 USB连接的打印机列表。
 */
 function scanUSBPrinters(callbackFunction) {
  //刷新设备时，关闭设备
  //closePrinter();
  var jsonObj = { apiName: 'scanUSBPrinters' };

  sendMsg(jsonObj, callbackFunction);
}

/**
 * 搜索Wifi打印机
 *
 * @param {function} callbackFunction - 获取信息后执行的回调函数。
 * @return {undefined} 该函数没有返回值。
 *
 * @description
 * 需要在打印服务连接成功后调用此函数，建议在打印服务连接成功的回调函数中调用。
 */
function scanWifiPrinter(callbackFunction) {
  timeout_duration = 25000;
  //刷新设备时，关闭设备
  //closePrinter();
  var jsonObj = { apiName: 'scanWifiPrinter' };

  sendMsg(jsonObj, callbackFunction);
}


/**
 * 发送消息以选择打印机。
 *
 * @param {string} printerName - 打印机名称。
 * @param {number} port - 端口号。
 * @param {function} callbackFunction - 消息发送后的回调函数。
 * @return {undefined} 无返回值。
 *
 * @description
 * 需要在打印服务连接成功后调用此函数，建议在getAllPrinters调用成功的回调接口中调用该接口，保证传入的打印机名称和端口的打印机状态正常。
 * 注意：此函数仅能连接 USB 打印机列表中的打印机。
 */
function selectPrinter(printerName, port, callbackFunction) {
  var jsonObj = {
    apiName: 'selectPrinter',
    parameter: { printerName: printerName, port: port }
  };
  sendMsg(jsonObj, callbackFunction);
}

/**
 * 发送消息以选择打印机。
 *
 * @param {string} printerName - 打印机名称。
 * @param {number} port - 端口号。
 * @param {function} callbackFunction - 消息发送后的回调函数。
 * @return {undefined} 无返回值。
 *
 * @description
 * 需要在打印服务连接成功后调用此函数，建议在scanWifiPrinter调用成功的回调接口中调用该接口，保证传入的打印机名称和端口的打印机状态正常。
 * 注意：此函数仅能连接 WIFI 打印机列表中的打印机。
 */
function connectWifiPrinter(printerName, port, callbackFunction) {
  timeout_duration = 25000;
  var jsonObj = {
    apiName: 'connectWifiPrinter',
    parameter: { printerName: printerName, port: port }
  };
  sendMsg(jsonObj, callbackFunction);
}

/**
 * 配置打印机的Wifi网络
 * 
 * @param {string} wifiName - wifi网络的名称。
 * @param {string} wifiPassword - wifi网络的密码。
 * @param {function} callbackFunction - wifi配置完成后要调用的回调函数。
 * @return {undefined} 此函数不返回任何值。
 * 
 * @description
 * 注意:仅支持2.4G频段网络，且需要在连接成功后配置。需要在USB连接成功后配置
 */
function configurationWifi(wifiName, wifiPassword, callbackFunction) {
  timeout_duration = 25000;
  var jsonObj = {
    apiName: 'configurationWifi',
    parameter: { wifiName: wifiName, wifiPassword: wifiPassword }
  }

  sendMsg(jsonObj, callbackFunction);
}

/**
 * 获取打印机的wifi配置。
 *
 * @param {function} callbackFunction - 在获取WiFi配置后将调用的回调函数。
 * @return {undefined} 此函数不返回任何值。
 */
function getWifiConfiguration(callbackFunction){
  var jsonObj = {
    apiName: 'getWifiConfiguration'
  }
  sendMsg(jsonObj, callbackFunction);
}



/**
 * 初始化绘制画板
 *
 * @param {Object} json - 包含初始化绘制画板所需数据的JSON对象。格式如下：
 * {
 *   "width": number, // 画板的宽度，单位为mm
 *   "height": number, // 画板的高度，单位为mm
 *   "rotate": number, // 画板的旋转角度，仅支持0、90、180、270
 *   "path": string, // 字体文件的路径，默认为""，暂不生效
 *   "verticalShift": number, // 垂直偏移量，暂不生效
 *   "horizontalShift": number // 水平偏移量，暂不生效
 * }
 * @param {Function} callbackFunction - 消息发送后要执行的回调函数。
 * @return {undefined} 此函数不返回任何值。
 *
 * @description
 * 增加接口说明:
 * 1. 在调用绘制接口之前，必须先初始化SDK。
 * 2. 绘制元素前，必须先初始化画板，否则会引起崩溃！
 * 3. 初始化画板时会清空画板上次绘制的内容！
 */
function InitDrawingBoard(json, callbackFunction) {
  var jsonObj = {
    apiName: 'InitDrawingBoard',
    parameter: json
  };

  sendMsg(jsonObj, callbackFunction);
}

/**
 * 绘制标签文本。
 * @param {object} json - 包含标签文本信息的JSON对象。
 *   JSON格式要求如下：
 *   - x: x轴坐标，单位mm
 *   - y: y轴坐标，单位mm
 *   - height: 文本高度，单位mm
 *   - width: 文本宽度，单位mm
 *   - value: 文本内容
 *   - fontFamily: 字体名称，暂不生效，使用默认字体思源黑体
 *   - rotate: 旋转角度，仅支持0、90、180、270
 *   - fontSize: 字号，单位mm
 *   - textAlignHorizonral: 水平对齐方式：0:左对齐 1:居中对齐 2:右对齐
 *   - textAlignVertical: 垂直对齐方式：0:顶对齐 1:垂直居中 2:底对齐
 *   - letterSpacing: 字母之间的标准间隔，单位mm
 *   - lineSpacing: 行间距（倍距），默认1
 *   - lineMode: 1:宽高固定，内容大小自适应，预设宽高过大时字号放大，预设宽高过小时字号缩小，
 *     保证内容占据满预设宽高（字号/字符间距/行间距 按比例缩放）
 *     2:宽度固定，高度自适应  
 *     4:宽高固定,超出内容直裁切
 *     6:宽高固定，内容超过预设的文本宽高自动缩放
 *     建议设置为6
 *   - fontStyle: 字体样式[加粗，斜体，下划线，删除下划线（预留）]
 * @param {function} callbackFunction - 绘制完成后执行的回调函数。
 * @description 绘制标签文本前必须先初始化画板
 */
function DrawLableText(json, callbackFunction) {
  var jsonObj = {
    apiName: 'DrawLableText',
    parameter: json
  };

  sendMsg(jsonObj, callbackFunction);
}

/**
 * 绘制一维码条形码。
 *
 * @param {Object} json - 包含一维码条形码信息的JSON对象。格式如下：
 * {
 *   "x": number, // x轴坐标，单位mm
 *   "y": number, // y轴坐标，单位mm
 *   "height": number, // 一维码宽度，单位mm
 *   "width": number, // 一维码高度，单位mm（包含文本高度）
 *   "value": string, // 一维码内容
 *   "codeType": number, // 条码类型：
 *                     // 20: CODE128
 *                     // 21: UPC-A
 *                     // 22: UPC-E
 *                     // 23: EAN8
 *                     // 24: EAN13
 *                     // 25: CODE93
 *                     // 26: CODE39
 *                     // 27: CODEBAR
 *                     // 28: ITF25
 *   "rotate": number, // 旋转角度，仅支持0、90、180、270
 *   "fontSize": number, // 文本字号，单位mm，字号为0则文本不显示
 *   "textHeight": number, // 文本高度，单位mm，高度为0则文本不显示
 *   "textPosition": number // 一维码文字识别码显示位置：
 *                          // 0: 下方显示
 *                          // 1: 上方显示
 *                          // 2: 不显示
 * }
 * @param {Function} callbackFunction - 消息发送后要执行的回调函数。
 * @return {undefined} 此函数不返回任何值。
 *
 * @description
 * 1. 绘制元素前，必须先初始化画板
 */
function DrawLableBarCode(json, callbackFunction) {
  var jsonObj = {
    apiName: 'DrawLableBarCode',
    parameter: json
  };

  sendMsg(jsonObj, callbackFunction);
}

/**
 * 绘制二维码。
 *
 * @param {Object} json - 包含二维码信息的JSON对象。格式如下：
 * {
 *   "x": number, // x轴坐标，单位mm
 *   "y": number, // y轴坐标，单位mm
 *   "height": number, // 二维码高度，默认宽高一致
 *   "width": number, // 二维码宽度，单位mm
 *   "value": string, // 二维码内容
 *   "codeType": number, // 条码类型：
 *                     // 31: QR_CODE
 *                     // 32: PDF417
 *                     // 33: DATA_MATRIX
 *                     // 34: AZTEC
 *   "rotate": number, // 旋转角度，仅支持0、90、180、270
 * }
 * @param {Function} callbackFunction - 消息发送后要执行的回调函数。
 * @return {undefined} 此函数不返回任何值。
 *
 * @description
 * 1. 绘制元素前，必须先初始化画板
 */
function DrawLableQrCode(json, callbackFunction) {
  var jsonObj = {
    apiName: 'DrawLableQrCode',
    parameter: json
  };

  sendMsg(jsonObj, callbackFunction);
}

/**
 * 绘制线条。
 *
 * @param {Object} json - 包含线条信息的JSON对象。格式如下：
 * {
 *   "x": number, // x轴坐标，单位mm
 *   "y": number, // y轴坐标，单位mm
 *   "height": number, // 线高，单位mm
 *   "width": number, // 线宽，单位mm
 *   "lineType": number, // 线条类型：1:实线 2:虚线类型,虚实比例1:1
 *   "rotate": number, // 旋转角度，仅支持0、90、180、270
 *   "dashwidth": number // 线条为虚线宽度，【实线段长度，空线段长度】
 * }
 * @param {Function} callbackFunction - 消息发送后要执行的回调函数。
 * @return {undefined} 此函数不返回任何值。
 *
 * @description
 * 1. 绘制元素前，必须先初始化画板
 */
function DrawLableLine(json, callbackFunction) {
  var jsonObj = {
    apiName: 'DrawLableLine',
    parameter: json
  };

  sendMsg(jsonObj, callbackFunction);
}

/**
 * 绘制图形。
 *
 * @param {Object} json - 包含绘制图形信息的JSON对象。格式如下：
 * {
 *   "x": number, // x轴坐标，单位mm
 *   "y": number, // y轴坐标，单位mm
 *   "height": number, // 图形高度，单位mm
 *   "width": number, // 图形宽度，单位mm
 *   "rotate": number, // 旋转角度，仅支持0、90、180、270
 *   "cornerRadius": number, // 圆角半径，单位mm，暂不生效
 *   "lineWidth": number, // 线宽，单位mm
 *   "lineType": number, // 线条类型：1:实线 2:虚线类型,虚实比例1:1
 *   "graphType": number, // 图形类型：1:圆，2:椭圆，3:矩形 4:圆角矩形
 *   "dashwidth": number // 线条为虚线宽度，【实线段长度，空线段长度】
 * }
 * @param {Function} callbackFunction - 消息发送后要执行的回调函数。
 * @return {undefined} 此函数不返回任何值。
 *
 * @description
 * 1. 绘制元素前，必须先初始化画板
 */
function DrawLableGraph(json, callbackFunction) {
  var jsonObj = {
    apiName: 'DrawLableGraph',
    parameter: json
  };

  sendMsg(jsonObj, callbackFunction);
}

/**
 * 绘制图片。
 *
 * @param {Object} json - 包含绘制图片信息的JSON对象。格式如下：
 * {
 *   "x": number, // x轴坐标，单位mm
 *   "y": number, // y轴坐标，单位mm
 *   "height": number, // 图片高度，单位mm
 *   "width": number, // 图片宽度，单位mm
 *   "rotate": number, // 旋转角度，仅支持0、90、180、270
 *   "imageProcessingType": number, // 图像处理算法，默认0
 *   "imageProcessingValue": number, // 算法参数，默认127
 *   "imageData": number, // 图片base64数据，不含数据头
 *                     // 如原始数据为“data:image/png;base64,iVBORw0KGgoAAAANSU”
 *                     // 传入的数据需要去除头部，数据为，“iVBORw0KGgoAAAANSU”
 * }
 * @param {Function} callbackFunction - 消息发送后要执行的回调函数。
 * @return {undefined} 此函数不返回任何值。
 *
 * @description
 * 增加接口说明:
 * 1. 绘制元素前，必须先初始化画板
 */
function DrawLableImage(json, callbackFunction) {
  var jsonObj = {
    apiName: 'DrawLableImage',
    parameter: json
  };

  sendMsg(jsonObj, callbackFunction);
}

/**
 * 生成图像预览图像。
 *
 * @param {number} displayScale - 图像显示比例，表示 1mm 的点数，可调整预览图大小。
 *                               例如，200dpi 的打印机可设置为 8，300dpi 的打印机可设置为 11.81。
 * @param {Function} callbackFunction - 图像生成后要执行的回调函数。
 * @return {undefined} 此函数不返回任何值。
 *
 * @description
 * 增加方法说明:
 * 1. 在调用此函数之前，必须确保图像数据已准备好，否则无法生成预览。
 */
function generateImagePreviewImage(displayScale, callbackFunction) {
  var jsonObj = {
    apiName: 'generateImagePreviewImage',
    displayScale: displayScale
  };

  sendMsg(jsonObj, callbackFunction);
}

/**
 * 启动打印任务。
 *
 * @param {number} printDensity - 打印浓度，根据不同打印机型号取值范围不同，具体如下：
 *                                - D11、D101、D110、H10、B16、B18: 取值范围 1~3，默认为 2。
 *                                - B3S、B203、B1、K3、K3W、M2: 取值范围 1~5，默认为 3。
 *                                - B50、B11、B50W、B32、Z401: 取值范围 1~15，默认为 8。
 * @param {number} paperType - 纸张类型，可选值：
 *                            1: 间隙纸
 *                            2: 黑标纸
 *                            3: 连续纸
 *                            4: 定孔纸
 *                            5: 透明纸
 *                            6: 标牌
 * @param {string} printMode - 打印模式，可选值：
 *                            1: 热敏
 *                            2: 热转印
 *                            注意，不同打印机型号支持的打印模式有限制，具体如下：
 *                            - D11、D101、D110、H10、B16、B18、B3S、B203、B1、K3、K3W、B11 仅支持热敏。
 *                            - B50、B50W、B32、Z401、M2 仅支持热转印。
 * @param {number} count - 总打印份数，表示所有页面的打印份数之和。
 *                         例如，如果你有3页需要打印，第一页打印3份，第二页打印2份，第三页打印5份，那么count的值应为10（3+2+5）。
 * @param {Function} callbackFunction - 打印任务启动后要执行的回调函数。
 * @return {undefined} 此函数不返回任何值。
 *
 * @description
 * 1. 在调用此函数之前，请确保打印设备已准备好并连接。
 */
function startJob(printDensity, printLabelType, printMode, count, callbackFunction) {
  var jsonObj = {
    apiName: 'startJob',
    parameter: {
      printDensity: printDensity,
      printLabelType: printLabelType,
      printMode: printMode,
      count: count
    }
  };
  sendMsg(jsonObj, callbackFunction);
}


/**
 * 提交打印任务，并执行回调函数。
 *
 * @param {string} [printData=null] - 打印数据的 JSON 字符串。
 * @param {string} printerImageProcessingInfo - 打印机图像处理信息的 JSON 字符串，包含打印份数信息，格式如下：
 * {
 *   "printerImageProcessingInfo": {
 *     "printQuantity": 1 // 用于指定当前页的打印份数。例如，如果需要打印3页，第一页打印3份，第二页打印2份，第三页打印5份，则在3次提交数据时，printerImageProcessingInfo 中的 "printQuantity" 值分别应为 3，2，5。
 *   }
 * }
 * @param {function} callbackFunction - 提交作业后的回调函数。
 * @return {undefined} 此函数不返回任何值。
 * 
 * @description
 * 需要先开启打印任务，完成绘制后再提交打印任务
 */
function commitJob(printData, printerImageProcessingInfo, callbackFunction) {
  // 解析 printDataJson，如果解析失败则使用空对象
  var printDataJson = parseJsonSafely(printData);

  // 解析 printerImageProcessingInfoJson，如果解析失败则使用空对象
  var printerImageProcessingInfoJson = parseJsonSafely(printerImageProcessingInfo);

  // 构建提交作业的参数对象
  var jsonObj = {
    apiName: 'commitJob',
    parameter: {
      printData: printDataJson,
      printerImageProcessingInfo: printerImageProcessingInfoJson['printerImageProcessingInfo'],
    }
  };

  // 调用 sendMsg 函数发送消息并执行回调函数
  sendMsg(jsonObj, callbackFunction);
}

/**
 * 结束打印任务
 * 
 * @param {function} callbackFunction - 结束任务后的回调函数
 * @description
 * 收到最后一页最后一份打印页面后调用该函数结束打印任务
 */
function endJob(callbackFunction) {
  var jsonObj = { apiName: 'endJob' };
  sendMsg(jsonObj, callbackFunction);
}

/**
 * 取消当前的打印任务，并执行回调函数。
 *
 * @param {function} callbackFunction - 取消打印任务后的回调函数。
 * @return {undefined} 此函数不返回任何值。
 */
function cancleJob(callbackFunction) {
  var jsonObj = { apiName: 'stopPrint' };
  sendMsg(jsonObj, callbackFunction);
}

/**
* 设置打印机的自动关机时间。
*
* @param {number} nType - 自动关机时间的类型：
*   1: 15分钟，
*   2: 30分钟，
*   3: 60分钟，
*   4: 从不
* @param {function} callbackFunction - 请求完成后的回调函数。
*/
function setPrinterAutoShutDownTime(nType, callbackFunction) {
  var jsonObj = {
    apiName: 'setPrinterAutoShutDownTime',
    parameter: { nType: nType }
  };
  sendMsg(jsonObj, callbackFunction);
}

/**
 * 将字符串解析为 JSON 对象，如果解析失败则返回空对象
 * @param {string} jsonString - 待解析的 JSON 字符串
 * @returns {object} - 解析得到的 JSON 对象
 */
function parseJsonSafely(jsonString) {
  try {
    return JSON.parse(jsonString) || {};
  } catch (error) {
    return {};
  }
}

/**
 * 在一定次数的尝试后从 API 获取结果。
 *
 * @param {number} tryTime - 尝试获取结果的次数。
 * @param {string} apiName - API 的名称。
 * @param {string} errInfo - 错误信息。
 * @return {object} 包含获取到的结果的对象。
 */
function getResult(tryTime, apiName, errInfo) {
  tryTimes = tryTime;

  let result = {};
  while (tryTimes--) {
    if (!isJSON(ackJsonData)) continue;

    var arrParse = JSON.parse(ackJsonData);
    if (arrParse['apiName'] === apiName) {
      result = arrParse['resultAck'];
      break;
    }
  }

  if (tryTimes <= 0) {
    result['result'] = false;
    result['errorCode'] = 0x12;
    result['info'] = errInfo;
  }
  return result;
}

/**
* 检查字符串是否为JSON格式。
*
* @param {string} str - 要检查的字符串。
* @returns {boolean} 如果字符串是JSON格式的，则返回true，否则返回false。
*/
function isJSON(str) {
  if (typeof str == 'string') {
    try {
      var obj = JSON.parse(str);
      if (typeof obj == 'object' && obj) {
        return true;
      } else {
        return false;
      }

    } catch (e) {
      //console.log('error：'+str+'!!!'+e);
      return false;
    }

  }

  console.log('It is not a string!');
}
