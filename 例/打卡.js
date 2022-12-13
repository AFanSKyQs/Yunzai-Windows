import fs from "fs";
import cfg from '../../lib/config/config.js'
import {segment} from "oicq";
import common from "../../lib/common/common.js";
import plugin from "../../lib/plugins/plugin.js";
import puppeteer from "puppeteer";

let _path = './resources/FanSky'
let path = './resources/FanSky/SignIn.json'
let path_SignTop = './resources/FanSky/SignTop.json'
//创建一个自动执行的异步函数
let Acg_url = `https://dev.iw233.cn/api.php?sort=cat`;

export class Bubbling extends plugin {
    constructor() {
        super({
            /** 功能名称 */
            name: '打卡',
            /** 功能描述 */
            dsc: '打卡，签到',
            /** https://oicqjs.github.io/oicq/#events */
            event: 'message',
            /** 优先级，数字越小等级越高 */
            priority: 5000,
            rule: [
                {
                    /** 命令正则匹配 */
                    //reg只匹配字符"打卡"或"#打卡"或"冒泡"或“#冒泡”
                    reg: /^#?(打卡|冒泡|签到)$/,
                    /** 执行方法 */
                    fnc: 'SingleTest',
                },
                {
                    //reg匹配“首次打卡时间”或“首次冒泡时间”
                    reg: /^#?(首次打卡时间|首次冒泡|首次打卡|首次冒泡时间)$/,
                    fnc: 'FirstSignTime',
                }
            ]
        })
        /** 定时任务 */
        this.task = {
            /** 任务名称 */
            name: '清除打卡状态',
            cron: '0 0 0 * * *',
            fnc: () => this.Eliminate(),
        }
    }

    /**定时任务*/
    async FirstSignTime(e) {
        if (!e.isGroup) {
            return true
        }
        //子目录
        if (!fs.existsSync(_path)) {
            console.log("已创建FanSky文件夹");
            fs.mkdirSync(_path);
        }
        //先判创建json文件,文件位置在../../resources/SignIn.json
        if (!fs.existsSync(path)) {
            fs.writeFileSync(path, '{}');
            console.log("已创建SignIn.json文件");
        }
        //将打卡信息写入json文件，每个群的群号和用户的QQ号作为键,添加打卡时间、打卡天数、打卡次数、连续打卡次数、今日是否打卡
        let SignDay = JSON.parse(fs.readFileSync(path));
        if (!SignDay[e.group_id][e.user_id]) {
            e.reply('你还没有打卡过哦,可以发送【打卡】来进行首次打卡~')
            return true
        }
        let FirstSignTime = new Date(SignDay[e.group_id][e.user_id].FirstSignTime).toLocaleString()
        e.reply(`您首次打卡时间:${FirstSignTime}`)
        return true
    }
    async SingleTest(e) {
        if (!e.isGroup) {
            return true
        }
        //子目录
        if (!fs.existsSync(_path)) {
            console.log("已创建FanSky文件夹");
            fs.mkdirSync(_path);
        }
        //先判创建json文件,文件位置在../../resources/SignIn.json
        if (!fs.existsSync(path)) {
            fs.writeFileSync(path, '{}');
            console.log("已创建SignIn.json文件");
        }
        //再判创建json文件,文件位置在../../resources/SignTop.json
        if (!fs.existsSync(path_SignTop)) {
            fs.writeFileSync(path_SignTop, '{}');
            console.log("已创建SignTop.json文件");
        }
        //将打卡信息写入json文件，每个群的群号和用户的QQ号作为键,添加打卡时间、打卡天数、打卡次数、连续打卡次数、今日是否打卡
        let SignDay = JSON.parse(fs.readFileSync(path));
        let SignTop = JSON.parse(fs.readFileSync(path_SignTop));
        //判断上次打卡时间与这次打卡时间间隔是否大于2分钟
        if (SignDay[e.group_id] && SignDay[e.group_id][e.user_id] && (Date.now() - SignDay[e.group_id][e.user_id].time) < 120000) {
            //将本次计数写入json
            SignDay[e.group_id][e.user_id].count++;
            fs.writeFileSync(path, JSON.stringify(SignDay));
            //发送消息，并返还剩余多久可以打卡
            e.reply(`距离上次打卡时间不足2分钟，还需等待${(120000 - (Date.now() - SignDay[e.group_id][e.user_id].time)) / 1000}秒,\n总打卡：【${SignDay[e.group_id][e.user_id].count}】次`);
            return true
        }
        if (!SignDay[e.group_id]) {
            SignDay[e.group_id] = {};
        }
        if (!SignDay[e.group_id][e.user_id]) {
            SignDay[e.group_id][e.user_id] = {
                time: 0,
                day: 0,
                count: 0,
                continuous: 0,
                today: false,
                rough: 0,
                FirstSignTime: 0
            }
        }
        //SignTop内为所有群的打卡排行榜
        if (!SignTop["AllGroupTopTime"]) {
            SignTop["AllGroupTopTime"] = {
                TopToday: 0,
            };
        }
        if (!SignTop["AllGroupTopTime"][e.user_id]) {
            SignTop["AllGroupTopTime"][e.user_id] = {
                TopNumber: 0,
            }
        }
        //判断今日是否打卡
        if (SignDay[e.group_id][e.user_id].today) {
            console.log("今日已打卡")
            //count计数器加一
            let lastTimeTemp = SignDay[e.group_id][e.user_id].time
            SignDay[e.group_id][e.user_id].count++;
            SignDay[e.group_id][e.user_id].time = Date.now();
            let MsgList = await this.MsgList(e, SignDay, lastTimeTemp, SignTop);
            e.reply(MsgList);
            fs.writeFileSync(path, JSON.stringify(SignDay));
            return true
        }
        //判断是否是第一次打卡
        if (!SignDay[e.group_id][e.user_id].time || SignDay[e.group_id][e.user_id].time === 0) {
            console.log("首次打卡")
            SignDay[e.group_id][e.user_id].time = Date.now();
            SignDay[e.group_id][e.user_id].count = 1;
            SignDay[e.group_id][e.user_id].day = 1;
            SignDay[e.group_id][e.user_id].continuous = 1;
            SignDay[e.group_id][e.user_id].rough = 160;
            SignDay[e.group_id][e.user_id].FirstSignTime = Date.now();
            //检索此用户是否在其他群已打卡
            let Temp = 0;
            for (let i in SignDay) {
                if (SignDay[i][e.user_id] && SignDay[i][e.user_id].today) {
                    Temp++;
                }
            }
            SignDay[e.group_id][e.user_id].today = true;
            if (Temp === 0) {
                SignTop["AllGroupTopTime"].TopToday++;
                SignTop["AllGroupTopTime"][e.user_id].TopNumber = SignTop["AllGroupTopTime"].TopToday;
            }
            /**SignTop内为所有群的打卡排行榜*/
            let MsgList = await this.FirstList(e, SignDay, SignTop);
            e.reply(MsgList);
            //AllGroupTopTime为所有群的打卡排行榜,AllGroupTopTime加一
            fs.writeFileSync(path_SignTop, JSON.stringify(SignTop));
            fs.writeFileSync(path, JSON.stringify(SignDay));
            return true
        }
        //获取打卡时间戳，传入addDay函数，并与今天的日期进行比较，判断是否连续打卡
        let lastDay = new Date(addDay(SignDay[e.group_id][e.user_id].time)).toLocaleDateString();
        let today = new Date().toLocaleDateString();
        console.log("lastDay:" + lastDay)
        console.log("today:" + today)
        if (lastDay === today) {
            console.log("进入了连续打卡")
            let lastTimeTemp = SignDay[e.group_id][e.user_id].time
            SignDay[e.group_id][e.user_id].time = Date.now();
            SignDay[e.group_id][e.user_id].count++;
            SignDay[e.group_id][e.user_id].day++;
            SignDay[e.group_id][e.user_id].continuous++;
            let Temp = 0;
            for (let i in SignDay) {
                if (SignDay[i][e.user_id] && SignDay[i][e.user_id].today) {
                    Temp++;
                }
            }
            SignDay[e.group_id][e.user_id].today = true;
            if (Temp === 0) {
                SignTop["AllGroupTopTime"].TopToday++;
                SignTop["AllGroupTopTime"][e.user_id].TopNumber = SignTop["AllGroupTopTime"].TopToday;
            }
            let TempRough = await this.GetRough(SignDay[e.group_id][e.user_id].continuous);
            SignDay[e.group_id][e.user_id].rough += TempRough;
            await common.sleep(1000);
            let MsgList = await this.MsgList(e, SignDay, lastTimeTemp, SignTop);
            e.reply(MsgList);
            fs.writeFileSync(path_SignTop, JSON.stringify(SignTop));
            fs.writeFileSync(path, JSON.stringify(SignDay));
            //调用SendAcg函数
            // await this.SendAcg(e);
            return true
        } else {
            console.log("断签了")
            //断签处理
            let lastTimeTemp = SignDay[e.group_id][e.user_id].time
            SignDay[e.group_id][e.user_id].time = Date.now();
            SignDay[e.group_id][e.user_id].count++;
            SignDay[e.group_id][e.user_id].day++;
            SignDay[e.group_id][e.user_id].continuous = 1;
            let Temp = 0;
            for (let i in SignDay) {
                if (SignDay[i][e.user_id] && SignDay[i][e.user_id].today) {
                    Temp++;
                }
            }
            SignDay[e.group_id][e.user_id].today = true;
            if (Temp === 0) {
                SignTop["AllGroupTopTime"].TopToday++;
                SignTop["AllGroupTopTime"][e.user_id].TopNumber = SignTop["AllGroupTopTime"].TopToday;
            }
            let TempRough = await this.GetRough(SignDay[e.group_id][e.user_id].continuous);
            SignDay[e.group_id][e.user_id].rough += TempRough;
            let MsgList = await this.MsgList(e, SignDay, lastTimeTemp, SignTop);
            e.reply(MsgList);
            fs.writeFileSync(path_SignTop, JSON.stringify(SignTop));
            fs.writeFileSync(path, JSON.stringify(SignDay));
        }

        function addDay(timestamp) {
            const date = new Date(timestamp);
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const day = date.getDate();
            const hour = date.getHours();
            const minute = date.getMinutes();
            const second = date.getSeconds();
            const newDate = new Date(year, month - 1, day + 1, hour, minute, second);
            return newDate.getTime();
        }

        return true;
    }
    //封装相同的消息列表
    async MsgList(e, Data, LastTimeTemp, SignTop) {
        return [
            //头像
            segment.image("https://q1.qlogo.cn/g?b=qq&nk=" + e.user_id + "&s=160"),
            "NickName: " + e.sender.nickname, "\n",
            "打卡天数: 【" + Data[e.group_id][e.user_id].day, "】天", "\n",
            "连续打卡: 【" + Data[e.group_id][e.user_id].continuous, "】天", "\n",
            "总计打卡: 【" + Data[e.group_id][e.user_id].count, "】次", "\n",
            "原石总计: 【" + Data[e.group_id][e.user_id].rough, "】\n",
            "上次打卡: " + new Date(LastTimeTemp).toLocaleString(), "\n",
            "今日全部: 第【" + SignTop["AllGroupTopTime"][e.user_id].TopNumber + "】位打卡用户",
            // segment.image(Acg_url),
        ]
    }
    async FirstList(e, Data, SignTop) {
        return [
            segment.image("https://q1.qlogo.cn/g?b=qq&nk=" + e.user_id + "&s=160"),
            "NickName: " + e.sender.nickname, "\n",
            "首次打卡！奖励160原石。", "\n",
            "打卡天数: 【" + Data[e.group_id][e.user_id].day, "】天", "\n",
            "总计打卡: 【" + Data[e.group_id][e.user_id].count, "】次", "\n",
            "原石总计: 【" + Data[e.group_id][e.user_id].rough, " 】\n",
            "上次打卡: " + new Date(Data[e.group_id][e.user_id].time).toLocaleString(), "\n",
            "今日全部: 第【" + SignTop["AllGroupTopTime"][e.user_id].TopNumber + "】位打卡用户",
            // "今日总排行: " + await this.GetRank(e, Data, "day"),
            // segment.image(Acg_url),
        ]
    }
    async GetRough(continuous) {
        let rough = Math.floor(Math.random() * 40 + 120);
        if (continuous >= 3) {
            rough += 20;
        }
        return rough
    }
    //清除每日打卡状态
    async Eliminate() {
        let data = JSON.parse(fs.readFileSync(path));
        for (let group in data) {
            for (let user in data[group]) {
                data[group][user].today = false;
            }
        }
        fs.writeFileSync(path, JSON.stringify(data));
        //将消息发送给机器人的主人
        let list = cfg.masterQQ;
        let msg = [
            "已清除今日打卡状态",
            "当前时间: " + new Date().toLocaleString()
        ];
        for (let userId of list) {
            await Bot.pickFriend(userId).sendMsg(msg)
        }
    }
}
