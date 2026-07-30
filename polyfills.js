import 'react-native-get-random-values';
import {Buffer} from 'buffer';

// CosmJS / bip39 依赖 Node Buffer，须在业务模块加载前注入
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}
