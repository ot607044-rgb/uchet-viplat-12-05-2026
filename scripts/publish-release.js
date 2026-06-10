const { execSync } = require('child_process')
const { version } = require('../package.json')

const tag = `v${version}`
const exe = `release/Учет выплат Setup ${version}.exe`
const blockmap = `release/Учет выплат Setup ${version}.exe.blockmap`
const yml = `release/latest.yml`

console.log(`Отправка тега ${tag} на GitHub...`)
execSync(`git push origin dev --tags`, { stdio: 'inherit' })

console.log(`Публикация релиза ${tag} на GitHub...`)
const gh = process.platform === 'win32' ? '"C:\\Program Files\\GitHub CLI\\gh.exe"' : 'gh'
execSync(`${gh} release create ${tag} "${exe}" "${yml}" "${blockmap}" --title "${tag}" --notes ""`, { stdio: 'inherit' })
console.log(`Готово: ${tag}`)
