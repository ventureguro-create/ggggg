import mongoose from 'mongoose';

const TgPostSchema = new mongoose.Schema({
  postId: String,
  channelId: String,
  channelUsername: String,
  messageId: Number,
  text: String,
  views: Number,
  date: Date,
  postedAt: Date,
  ingestedAt: Date,
}, { collection: 'tg_posts' });

const TgPostModel = mongoose.model('TgPost', TgPostSchema);

async function run() {
  await mongoose.connect('mongodb://localhost:27017/telegram_dev');
  
  const testPosts = [
    {
      postId: 'test_crypto:1001',
      channelId: 'test_crypto',
      channelUsername: 'test_crypto',
      messageId: 1001,
      text: '$ARB looking bullish! Price moving up',
      views: 1000,
      date: new Date(),
      postedAt: new Date(),
      ingestedAt: new Date(),
    },
    {
      postId: 'test_crypto:1002',
      channelId: 'test_crypto',
      channelUsername: 'test_crypto',
      messageId: 1002,
      text: 'Just bought some #SOL and $ETH for the portfolio',
      views: 2000,
      date: new Date(),
      postedAt: new Date(),
      ingestedAt: new Date(),
    },
    {
      postId: 'test_crypto:1003',
      channelId: 'test_crypto',
      channelUsername: 'test_crypto',
      messageId: 1003,
      text: 'Check ARB/USDT pair on Binance, BTC/ETH also moving',
      views: 1500,
      date: new Date(),
      postedAt: new Date(),
      ingestedAt: new Date(),
    },
    {
      postId: 'test_crypto:1004',
      channelId: 'test_crypto',
      channelUsername: 'test_crypto',
      messageId: 1004,
      text: 'New listing alert! PEPE/USDT on KuCoin',
      views: 3000,
      date: new Date(),
      postedAt: new Date(),
      ingestedAt: new Date(),
    },
    {
      postId: 'test_crypto:1005',
      channelId: 'test_crypto',
      channelUsername: 'test_crypto',
      messageId: 1005,
      text: 'Airdrop coming for $MAGIC holders! Check for airdrop',
      views: 2500,
      date: new Date(),
      postedAt: new Date(),
      ingestedAt: new Date(),
    },
  ];

  await TgPostModel.deleteMany({ channelUsername: 'test_crypto' });
  const result = await TgPostModel.insertMany(testPosts);
  console.log('Inserted', result.length, 'test posts');
  
  await mongoose.disconnect();
}

run().catch(console.error);
