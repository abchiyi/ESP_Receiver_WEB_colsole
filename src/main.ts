import { createApp } from 'vue'
import TDesign from 'tdesign-vue-next';
// import {
//     Button as TButton,
//     Header as THeader,
//     Form as TForm,
//     FormItem as TFormItem,
//     Content as TContent,
//     Footer as TFooter,
//     HeadMenu as THeadMenu,
//     MenuItem as TMenuItem,
//     Space as TSpace,
//     Input as TInput,
//     Icon as TIcon,
//     Layout as TLayout,
//     Select as TSelect,
//     Option as TOption,
// } from 'tdesign-vue-next';



import 'tdesign-vue-next/es/style/index.css';

import App from './App.vue'

createApp(App)
    // .use(TButton)
    // .use(THeader)
    // .use(TForm)
    // .use(TFormItem)
    // .use(TContent)
    // .use(TFooter)
    // .use(THeadMenu)
    // .use(TMenuItem)
    // .use(TSpace)
    // .use(TInput)
    // .use(TIcon)
    // .use(TLayout)
    // .use(TSelect)
    // .use(TOption)
    .use(TDesign)
    .mount('#app')
