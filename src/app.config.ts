export default defineAppConfig({
  pages: [
    'pages/script/index',
    'pages/rehearsal/index',
    'pages/annotation/index'
  ],
  window: {
    backgroundTextStyle: 'dark',
    navigationBarBackgroundColor: '#0D0D14',
    navigationBarTitleText: '剧本导入',
    navigationBarTextStyle: 'white',
    backgroundColor: '#0D0D14'
  },
  tabBar: {
    color: '#6E6E8A',
    selectedColor: '#7B3AED',
    backgroundColor: '#1A1A24',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/script/index',
        text: '剧本导入'
      },
      {
        pagePath: 'pages/rehearsal/index',
        text: '分支排练'
      },
      {
        pagePath: 'pages/annotation/index',
        text: '情绪批注'
      }
    ]
  }
})
