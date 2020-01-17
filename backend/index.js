const express = require('express');
const cors = require('cors');
const fileUpLoad = require('express-fileupload');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const fetch = require('node-fetch');
const xlsx = require('node-xlsx');
const FormData = require('form-data');

const app = express();

const UPLOAD_FILE_DIC = path.resolve(__dirname, './static/files');
const TEMP_UPLOAD_DIC = path.resolve(__dirname, './uploads');

const ImageSuffix = ['jpg', 'png', 'jpeg'];

async function readFiles() {
	const files = fs.readdirSync(UPLOAD_FILE_DIC);
	return files;
}

// 允许跨域
app.use(cors());
app.use(express.json());
app.use(express.static('static'));
// 上传文件中间件
app.use(
	fileUpLoad({
		limits: {
			fileSize: 20 * 1024 * 1024
		} // 最大20M
	})
);

/**
 * 接收上传过来的文件
 */
app.use('/saveFile', async (req, res) => {
	const {
		file
	} = req.files;
	
	const filePath = `${UPLOAD_FILE_DIC}/${file.name}`;
	const files = await readFiles();
	if (files.includes(file.name)) {
		return res.status(500).json({
			code: 500,
			message: '已存在同名文件,请重复上传'
		});
	}
	fs.writeFile(filePath, file.data, 'utf-8', (err) => {
		if (err) throw err;
		res.status(200).json({
			code: 200,
			message: 'success',
			data: {
				path: filePath
			}
		});
	});
});

/**
 * 暂存
 */
app.use('/uploadFile', async (req, res) => {
	const {
		file
	} = req.files;
	const filePath = `${TEMP_UPLOAD_DIC}/${file.name}`;
	const files = await readFiles();
	if (files.includes(file.name)) {
		return res.status(500).json({
			code: 500,
			message: '已存在同名图片,请重复上传'
		});
	}
	fs.writeFile(filePath, file.data, 'utf-8', (err) => {
		if (err) throw err;
		res.status(200).json({
			code: 200,
			message: 'success',
			data: {
				path: filePath
			}
		});
	});
});

/**
 * node端上传文件,从uploads文件夹存到/static/files文件夹
 */
app.use('/nodeUploadFile', async (req, res) => {
	const { query: { filename, type } } = req;
	const filePath = `${TEMP_UPLOAD_DIC}/${filename}`;
	const form = new FormData();
	const file = fs.createReadStream(filePath);
	form.append('file', file);
	const url = 'http://localhost:3008/saveFile'
	// axios逻辑
	const resData = type === 'fetch'
	  ? await fetch(url, {
			method: 'post',
			headers: {
				...form.getHeaders()
			},
			credentials: 'include',
			body: form,
			mode: 'cors',
			cache: 'no-cache'
		}) : await axios({
		method: 'post',
		url,
		data: form,
		headers: {
			...form.getHeaders()
		}
	});
	fs.unlink(filePath, (err) => {
		if (err) console.log(err);
	});
	const result = type === 'fetch' ? await resData.json() : resData.data;
	res.status(200).json(result);
});

/**
 * 获取文件列表
 */
app.use('/list', async (req, res) => {
	const files = await readFiles();
	const list = files.map(item => ({
		filename: item,
		type: ImageSuffix.includes(item.split('.').pop()) ? 'image' : 'file'
	}))
	res.status(200).json({
		code: 200,
		message: '',
		data: list
	});
});
/**
 * 下载文件
 */
app.use('/downloadFile', async (req, res) => {
	const { query: { filename } } = req;
	const filePath = `${UPLOAD_FILE_DIC}/${filename}`;
	res.setHeader('Content-disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
	res.setHeader('Content-Type', 'application/octet-stream');
	// pipe generated file to the response
	fs.createReadStream(filePath).pipe(res);
	// res.download(filePath); // 如果简单,一行代码也可以
});

/**
 * 下载excel
 */
app.use('/downloadExcel', async (req, res) => {
	const { data: { data } } = await axios.get('http://localhost:3008/list');
	const tableHeader = ['文件名', '文件类型', '文件地址'];
	const tableBody = data.map(item => (
		[item.filename, item.type === 'image' ? '图片' : '文件', `http://localhost:3008/files/${item.filename}`]
	));
	const tableData = [tableHeader, ...tableBody];
	const buffer = xlsx.build([
		{name: 'Sheet1', data: tableData},
		{name: 'Sheet2', data: tableData}
	]);
  res.status(200)
		.attachment('bufferExcel.xlsx')
		.send(buffer);
});

/**
 * 删除文件
 */
app.use('/deleteFile', async (req, res) => {
	const { query: { filename } } = req;
	const filePath = `${TEMP_UPLOAD_DIC}/${filename}`;
	fs.unlink(filePath, (err) => {
		if (err) console.log(err);
		res.status(200);
	});
});

app.listen('3008', async (req, res) => {
	console.log("http://localhost:3008");
});
